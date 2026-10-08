"""Meeting use-cases: list/filter, create (form, paste, upload), update, delete, (re)summarize.

Routers stay thin and call into this module; it owns transactions (`db.commit()`).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

from sqlalchemy import Select, case, exists, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    ActionItem,
    Channel,
    Chapter,
    Comment,
    Meeting,
    MeetingChannel,
    MeetingParticipant,
    Participant,
    Summary,
    TranscriptSegment,
    User,
)
from app.models.mixins import utcnow
from app.schemas.meeting import MeetingCreate, MeetingUpdate
from app.services.ai import Line, MeetingContext, get_summarizer
from app.services.ai.types import SummaryDraft
from app.services.errors import InvalidInput, NotFound
from app.services.people import get_or_create_participant
from app.services.transcript_parser import ParsedSegment

# --- reading ------------------------------------------------------------------

@dataclass
class MeetingFilters:
    """Mirrors the Fireflies Notebook filters popover."""

    q: str | None = None
    scope: str = "all"  # all | mine (hosted by me) | shared (I attended, someone else hosted)
    host_ids: list[int] = field(default_factory=list)
    participant_ids: list[int] = field(default_factory=list)
    channel_ids: list[int] = field(default_factory=list)
    platforms: list[str] = field(default_factory=list)  # "Captured from"
    date_from: date | None = None
    date_to: date | None = None
    min_duration_min: int | None = None
    max_duration_min: int | None = None
    sort: str = "recent"


def _has_participant(ids: list[int], role: str | None = None):
    cond = [MeetingParticipant.meeting_id == Meeting.id, MeetingParticipant.participant_id.in_(ids)]
    if role:
        cond.append(MeetingParticipant.role == role)
    return exists().where(*cond)


def _apply_filters(stmt: Select, f: MeetingFilters, me: Participant | None) -> Select:
    if f.q:
        like = f"%{f.q.strip().lower()}%"
        by_participant = exists().where(
            MeetingParticipant.meeting_id == Meeting.id,
            MeetingParticipant.participant_id == Participant.id,
            or_(func.lower(Participant.name).like(like), func.lower(Participant.email).like(like)),
        )
        stmt = stmt.where(or_(func.lower(Meeting.title).like(like), by_participant))
    if f.scope == "mine":
        stmt = stmt.where(_has_participant([me.id], "host")) if me else stmt.where(False)
    elif f.scope == "shared":  # attended but hosted by someone else
        stmt = stmt.where(_has_participant([me.id], "attendee")) if me else stmt.where(False)
    if f.host_ids:
        stmt = stmt.where(_has_participant(f.host_ids, "host"))
    if f.participant_ids:  # checkbox list: any of the selected people
        stmt = stmt.where(_has_participant(f.participant_ids))
    if f.channel_ids:
        stmt = stmt.where(exists().where(MeetingChannel.meeting_id == Meeting.id, MeetingChannel.channel_id.in_(f.channel_ids)))
    if f.platforms:
        stmt = stmt.where(Meeting.platform.in_(f.platforms))
    if f.date_from:
        stmt = stmt.where(Meeting.started_at >= datetime.combine(f.date_from, datetime.min.time()))
    if f.date_to:
        stmt = stmt.where(Meeting.started_at < datetime.combine(f.date_to + timedelta(days=1), datetime.min.time()))
    if f.min_duration_min is not None:
        stmt = stmt.where(Meeting.duration_ms >= f.min_duration_min * 60_000)
    if f.max_duration_min is not None:
        stmt = stmt.where(Meeting.duration_ms < f.max_duration_min * 60_000)
    return stmt


def user_participant(db: Session, user: User) -> Participant | None:
    """The participant record that represents the logged-in user (matched by email)."""
    return db.scalar(select(Participant).where(Participant.email == user.email.lower()))


_SORTS = {
    "recent": (Meeting.started_at.desc(),),
    "oldest": (Meeting.started_at.asc(),),
    "longest": (Meeting.duration_ms.desc(), Meeting.started_at.desc()),
    "shortest": (Meeting.duration_ms.asc(), Meeting.started_at.desc()),
    "title": (func.lower(Meeting.title).asc(),),
}


def list_meetings(db: Session, user: User, f: MeetingFilters, page: int, page_size: int):
    """Returns (rows, total) where rows are (Meeting, total_items, open_items)."""
    base = _apply_filters(select(Meeting).where(Meeting.owner_id == user.id), f, user_participant(db, user))
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0

    counts = (
        select(
            ActionItem.meeting_id,
            func.count(ActionItem.id).label("total"),
            func.sum(case((ActionItem.is_completed.is_(False), 1), else_=0)).label("open"),
        )
        .group_by(ActionItem.meeting_id)
        .subquery()
    )
    stmt = (
        base.add_columns(func.coalesce(counts.c.total, 0), func.coalesce(counts.c.open, 0))
        .outerjoin(counts, counts.c.meeting_id == Meeting.id)
        .options(selectinload(Meeting.participant_links), selectinload(Meeting.channel_links), selectinload(Meeting.summary))
        .order_by(*_SORTS.get(f.sort, _SORTS["recent"]))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return db.execute(stmt).all(), total


def get_meeting(db: Session, meeting_id: int, owner_id: int) -> Meeting:
    meeting = db.scalar(
        select(Meeting)
        .where(Meeting.id == meeting_id, Meeting.owner_id == owner_id)
        .options(
            selectinload(Meeting.participant_links), selectinload(Meeting.channel_links),
            selectinload(Meeting.summary), selectinload(Meeting.chapters), selectinload(Meeting.action_items),
        )
    )
    if meeting is None:
        raise NotFound(f"Meeting {meeting_id} not found")
    return meeting


def meeting_counts(db: Session, meeting_id: int) -> tuple[int, int]:
    segments = db.scalar(select(func.count()).where(TranscriptSegment.meeting_id == meeting_id)) or 0
    comments = db.scalar(select(func.count()).where(Comment.meeting_id == meeting_id)) or 0
    return segments, comments


# --- writing ------------------------------------------------------------------

def _set_participants(db: Session, meeting: Meeting, people: list[tuple[str, str | None, str]]) -> None:
    """Replace the participant list. `people` = [(name, email, role)]."""
    wanted: dict[int, str] = {}
    for name, email, role in people:
        if name.strip():
            p = get_or_create_participant(db, name, email)
            wanted.setdefault(p.id, role)
    existing = {link.participant_id: link for link in meeting.participant_links}
    for pid, link in existing.items():
        if pid not in wanted:
            meeting.participant_links.remove(link)
    for pid, role in wanted.items():
        if pid in existing:
            existing[pid].role = role
        else:
            meeting.participant_links.append(MeetingParticipant(participant_id=pid, role=role))
    db.flush()
    db.expire(meeting, ["participant_links"])


class InvalidChannel(InvalidInput):
    pass


def set_channels(db: Session, meeting: Meeting, channel_ids: list[int]) -> None:
    """Replace the meeting's channels ("Move to channel")."""
    wanted = set(channel_ids)
    if wanted:
        owned = set(db.scalars(select(Channel.id).where(Channel.id.in_(wanted), Channel.owner_id == meeting.owner_id)))
        if owned != wanted:
            raise InvalidChannel(f"Unknown channel(s): {sorted(wanted - owned)}")
    meeting.channel_links[:] = [link for link in meeting.channel_links if link.channel_id in wanted]
    have = {link.channel_id for link in meeting.channel_links}
    meeting.channel_links.extend(MeetingChannel(channel_id=c) for c in wanted - have)
    db.flush()
    db.expire(meeting, ["channel_links"])


def _store_segments(db: Session, meeting: Meeting, parsed: list[ParsedSegment]) -> list[TranscriptSegment]:
    speakers: dict[str, Participant] = {}
    rows = []
    for pos, seg in enumerate(parsed):
        participant = None
        if seg.speaker:
            key = seg.speaker.lower()
            if key not in speakers:
                speakers[key] = get_or_create_participant(db, seg.speaker)
            participant = speakers[key]
        rows.append(TranscriptSegment(
            meeting_id=meeting.id, participant_id=participant.id if participant else None,
            position=pos, start_ms=seg.start_ms or 0, end_ms=seg.end_ms or 0, text=seg.text,
        ))
    db.add_all(rows)
    db.flush()
    # Every speaker is a participant of the meeting.
    linked = {link.participant_id for link in meeting.participant_links}
    for p in speakers.values():
        if p.id not in linked:
            meeting.participant_links.append(MeetingParticipant(participant_id=p.id, role="attendee"))
    if rows:
        meeting.duration_ms = max(meeting.duration_ms, rows[-1].end_ms)
    db.flush()
    return rows


def create_meeting(
    db: Session, user: User, data: MeetingCreate, parsed: list[ParsedSegment] | None,
    source_filename: str | None = None, source_size_bytes: int | None = None,
) -> Meeting:
    meeting = Meeting(
        owner_id=user.id,
        title=data.title.strip(),
        started_at=(data.started_at.replace(tzinfo=None) if data.started_at else utcnow()),
        platform=data.platform,
        description=data.description,
        language=data.language,
        duration_ms=(data.duration_minutes or 0) * 60_000,
        source_filename=source_filename,
        source_size_bytes=source_size_bytes,
    )
    db.add(meeting)
    db.flush()
    # The first listed participant hosts; with nobody listed, the creator hosts (e.g. uploads).
    people = [(p.name, p.email) for p in data.participants] or [(user.name, user.email)]
    _set_participants(db, meeting, [(name, email, "host" if i == 0 else "attendee") for i, (name, email) in enumerate(people)])
    set_channels(db, meeting, data.channel_ids)
    if parsed:
        _store_segments(db, meeting, parsed)
        if data.generate_summary:
            summarize_meeting(db, meeting, commit=False)
    db.commit()
    return get_meeting(db, meeting.id, user.id)


def update_meeting(db: Session, meeting: Meeting, data: MeetingUpdate) -> Meeting:
    if data.title is not None:
        meeting.title = data.title.strip()
    if data.started_at is not None:
        meeting.started_at = data.started_at.replace(tzinfo=None)
    if data.language is not None:
        meeting.language = data.language
    if "description" in data.model_fields_set:
        meeting.description = data.description
    if data.participants is not None:
        roles = {link.participant.name.lower(): link.role for link in meeting.participant_links}
        _set_participants(db, meeting, [(p.name, p.email, roles.get(p.name.lower(), "attendee")) for p in data.participants])
    if data.channel_ids is not None:
        set_channels(db, meeting, data.channel_ids)
    meeting.updated_at = utcnow()
    db.commit()
    return get_meeting(db, meeting.id, meeting.owner_id)


def delete_meeting(db: Session, meeting: Meeting) -> None:
    db.delete(meeting)
    db.commit()


def bulk_action(db: Session, owner_id: int, action: str, meeting_ids: list[int], channel_ids: list[int]) -> int:
    """Delete or move many meetings at once; returns how many were affected."""
    meetings = list(db.scalars(
        select(Meeting).where(Meeting.id.in_(meeting_ids), Meeting.owner_id == owner_id)
        .options(selectinload(Meeting.channel_links))
    ))
    for meeting in meetings:
        if action == "delete":
            db.delete(meeting)
        else:
            set_channels(db, meeting, channel_ids)
    db.commit()
    return len(meetings)


# --- AI summary -------------------------------------------------------------------

def build_context(db: Session, meeting: Meeting) -> tuple[MeetingContext, list[TranscriptSegment]]:
    segments = db.scalars(
        select(TranscriptSegment).where(TranscriptSegment.meeting_id == meeting.id).order_by(TranscriptSegment.position)
    ).all()
    lines = [Line(i, s.speaker.name if s.speaker else None, s.start_ms, s.end_ms, s.text) for i, s in enumerate(segments)]
    return MeetingContext(
        title=meeting.title,
        participants=[p.name for p in meeting.participants],
        lines=lines,
        overview=meeting.summary.overview if meeting.summary else None,
        action_items=[a.text for a in meeting.action_items],
    ), list(segments)


def apply_summary(db: Session, meeting: Meeting, draft: SummaryDraft, segments: list[TranscriptSegment]) -> None:
    """Persist a SummaryDraft: replaces the summary, chapters and AI-sourced open action items.
    User-created and completed action items are preserved."""
    if meeting.summary is None:
        meeting.summary = Summary(meeting_id=meeting.id)
    s = meeting.summary
    s.overview, s.keywords, s.notes, s.generated_by = draft.overview, draft.keywords, draft.notes, draft.engine
    s.updated_at = utcnow()

    for ch in list(meeting.chapters):
        db.delete(ch)
    for ch in draft.chapters:
        db.add(Chapter(meeting_id=meeting.id, title=ch.title[:255], description=ch.description,
                       start_ms=ch.start_ms, end_ms=ch.end_ms))

    keep = [a for a in meeting.action_items if a.source == "user" or a.is_completed]
    for a in meeting.action_items:
        if a not in keep:
            db.delete(a)
    names = {p.name.lower(): p for p in meeting.participants}
    firsts = {p.name.split()[0].lower(): p for p in meeting.participants}
    position = max((a.position for a in keep), default=-1) + 1
    for draft_item in draft.action_items:
        assignee = None
        if draft_item.assignee:
            key = draft_item.assignee.lower()
            assignee = names.get(key) or firsts.get(key.split()[0])
        seg = segments[draft_item.line_index] if draft_item.line_index is not None and draft_item.line_index < len(segments) else None
        db.add(ActionItem(
            meeting_id=meeting.id, text=draft_item.text, assignee_id=assignee.id if assignee else None,
            segment_id=seg.id if seg else None, timestamp_ms=seg.start_ms if seg else None,
            position=position, source="ai",
        ))
        position += 1
    db.flush()
    db.expire(meeting, ["chapters", "action_items", "summary"])


def summarize_meeting(db: Session, meeting: Meeting, commit: bool = True) -> Meeting:
    ctx, segments = build_context(db, meeting)
    draft = get_summarizer().summarize(ctx)
    apply_summary(db, meeting, draft, segments)
    if commit:
        db.commit()
    return meeting


def update_summary(
    db: Session, meeting: Meeting, overview: str | None = None,
    keywords: list[str] | None = None, notes: list[dict] | None = None,
) -> Summary:
    """Manual edit of the AI summary; marks it as user-authored."""
    if meeting.summary is None:
        meeting.summary = Summary(meeting_id=meeting.id, overview="", keywords=[], notes=[])
    s = meeting.summary
    if overview is not None:
        s.overview = overview
    if keywords is not None:
        s.keywords = keywords
    if notes is not None:
        s.notes = notes
    s.generated_by = "user"
    s.updated_at = utcnow()
    db.commit()
    return s


def workspace_stats(db: Session, owner_id: int) -> dict:
    meetings = db.execute(
        select(func.count(Meeting.id), func.coalesce(func.sum(Meeting.duration_ms), 0)).where(Meeting.owner_id == owner_id)
    ).one()
    week_ago = utcnow() - timedelta(days=7)
    this_week = db.scalar(select(func.count()).where(Meeting.owner_id == owner_id, Meeting.started_at >= week_ago)) or 0
    items = db.execute(
        select(
            func.count(ActionItem.id),
            func.coalesce(func.sum(case((ActionItem.is_completed.is_(False), 1), else_=0)), 0),
        ).join(Meeting).where(Meeting.owner_id == owner_id)
    ).one()
    people = db.scalar(
        select(func.count(func.distinct(MeetingParticipant.participant_id))).join(Meeting).where(Meeting.owner_id == owner_id)
    ) or 0
    return {
        "meeting_count": meetings[0], "total_duration_ms": int(meetings[1]), "meetings_this_week": this_week,
        "action_items_total": items[0], "action_items_open": int(items[1]), "participant_count": people,
    }

