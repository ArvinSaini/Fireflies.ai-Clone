"""Workspace-wide AskFred: answer questions across *all* of the user's meetings.

Strategy (retrieval-augmented):
  * task / recap questions are answered directly from structured data (action items, summaries);
  * anything else retrieves the most relevant transcript lines with the FTS index and hands them
    to the regular per-meeting assistant (Claude when configured, heuristic otherwise) as a
    synthetic "meeting" whose speakers are labelled with their meeting title.
"""
from __future__ import annotations

import re
from datetime import timedelta

from sqlalchemy import select, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.models import ActionItem, Meeting, TranscriptSegment, User
from app.models.mixins import utcnow
from app.services.ai import Line, MeetingContext, get_assistant
from app.services.ai.text_utils import content_words, truncate_words

TASKS = re.compile(r"action item|task|to-?do|follow[- ]?up|assigned|owe|next step", re.I)
LAST_MEETING = re.compile(r"\b(last|latest|most recent|previous) meeting\b", re.I)
UPCOMING = re.compile(r"\bupcoming\b|\bnext meeting\b|prepare me", re.I)
DECISIONS = re.compile(r"decision|decided|agree", re.I)
INITIATIVES = re.compile(r"initiative|priorit|project|roadmap|focus area", re.I)
RECAP = re.compile(r"summar|recap|this week|last week|overview|what happened|catch me up|digest", re.I)
_DECISION_LINE = re.compile(r"\b(decid|agree|approved|let's go with|we'll go with|final call|sounds like a plan|consensus)", re.I)


def _citation(seg: TranscriptSegment, meeting: Meeting) -> dict:
    return {
        "meeting_id": meeting.id, "meeting_title": meeting.title, "segment_id": seg.id,
        "start_ms": seg.start_ms, "speaker": seg.speaker.name if seg.speaker else None, "text": seg.text,
    }


def _open_tasks(db: Session, user: User) -> dict:
    rows = db.execute(
        select(ActionItem, Meeting).join(Meeting)
        .where(Meeting.owner_id == user.id, ActionItem.is_completed.is_(False))
        .order_by(Meeting.started_at.desc(), ActionItem.position).limit(10)
    ).all()
    if not rows:
        return {"answer": "You have no open action items. 🎉", "citations": []}
    lines = [f"• {a.text}" + (f" — {a.assignee.name}" if a.assignee else "") + f" ({m.title})" for a, m in rows]
    return {"answer": "Here are the most recent open action items across your meetings:\n" + "\n".join(lines),
            "citations": [], "meetings": _meeting_refs([m for _, m in rows])}


def _recent_meetings(db: Session, user: User, limit: int) -> list[Meeting]:
    return list(db.scalars(
        select(Meeting).where(Meeting.owner_id == user.id).order_by(Meeting.started_at.desc()).limit(limit)
    ))


def _last_meeting(db: Session, user: User, intro: str = "") -> dict:
    recent = _recent_meetings(db, user, 1)
    if not recent:
        return {"answer": "You don't have any meetings yet.", "citations": []}
    m = recent[0]
    lines = [f"{intro}Your most recent meeting was “{m.title}”."]
    if m.summary and m.summary.overview:
        lines.append(truncate_words(m.summary.overview, 70))
    open_items = [a for a in m.action_items if not a.is_completed][:4]
    if open_items:
        lines.append("Open action items:")
        lines += [f"• {a.text}" + (f" — {a.assignee.name}" if a.assignee else "") for a in open_items]
    return {"answer": "\n".join(lines), "citations": [], "meetings": _meeting_refs([m])}


def _upcoming(db: Session, user: User) -> dict:
    # Calendar sync is a placeholder in this demo, so there is no real "next meeting" to prepare for.
    return _last_meeting(
        db, user,
        intro="No upcoming meetings are on your calendar (calendar sync isn't connected in this demo). "
              "To pick up where you left off: ",
    )


def _decisions(db: Session, user: User) -> dict:
    rows = db.execute(
        select(TranscriptSegment, Meeting).join(Meeting)
        .where(Meeting.owner_id == user.id).order_by(Meeting.started_at.desc(), TranscriptSegment.position)
    ).all()
    hits = [(s, m) for s, m in rows if _DECISION_LINE.search(s.text)][:6]
    if not hits:
        return {"answer": "I couldn't find explicit decisions in your meetings.", "citations": []}
    body = "\n".join(f"• {m.title}: “{truncate_words(s.text, 28)}”" for s, m in hits)
    return {"answer": "Key decisions from your recent meetings:\n" + body,
            "citations": [_citation(s, m) for s, m in hits], "meetings": _meeting_refs([m for _, m in hits])}


def _initiatives(db: Session, user: User) -> dict:
    meetings = [m for m in _recent_meetings(db, user, 8) if m.summary and m.summary.keywords]
    if not meetings:
        return {"answer": "No initiatives found yet — they come from your meetings' AI notes.", "citations": []}
    lines = [f"• {m.title}: {', '.join(m.summary.keywords[:4])}" for m in meetings[:6]]
    return {"answer": "Key initiatives and topics across your recent meetings:\n" + "\n".join(lines),
            "citations": [], "meetings": _meeting_refs(meetings[:6])}


def _recap(db: Session, user: User) -> dict:
    since = utcnow() - timedelta(days=7)
    meetings = list(db.scalars(
        select(Meeting).where(Meeting.owner_id == user.id, Meeting.started_at >= since).order_by(Meeting.started_at.desc())
    ))
    if not meetings:
        return {"answer": "You had no meetings in the last 7 days.", "citations": []}
    lines = []
    for m in meetings:
        overview = m.summary.overview if m.summary else ""
        first = re.split(r"(?<=[.!?])\s", overview)[0] if overview else "No summary yet."
        lines.append(f"• {m.title}: {truncate_words(first, 30)}")
    return {"answer": f"You had {len(meetings)} meetings in the last 7 days:\n" + "\n".join(lines),
            "citations": [], "meetings": _meeting_refs(meetings)}


def _meeting_refs(meetings: list[Meeting]) -> list[dict]:
    seen, out = set(), []
    for m in meetings:
        if m.id not in seen:
            seen.add(m.id)
            out.append({"meeting_id": m.id, "meeting_title": m.title, "started_at": m.started_at.isoformat()})
    return out


def _retrieve(db: Session, user: User, question: str, limit: int = 12) -> list[tuple[TranscriptSegment, Meeting]]:
    terms = [w for w in content_words(question) if len(w) > 2][:8]
    if not terms:
        return []
    fts = " OR ".join(f'"{t}"*' for t in terms)
    try:
        ids = [r[0] for r in db.execute(text(
            "SELECT s.id FROM segments_fts JOIN transcript_segments s ON s.id = segments_fts.rowid "
            "JOIN meetings m ON m.id = s.meeting_id WHERE segments_fts MATCH :q AND m.owner_id = :o "
            "ORDER BY bm25(segments_fts) LIMIT :n"), {"q": fts, "o": user.id, "n": limit})]
    except OperationalError:
        ids = []
    if not ids:
        return []
    rows = db.execute(select(TranscriptSegment, Meeting).join(Meeting).where(TranscriptSegment.id.in_(ids))).all()
    order = {sid: i for i, sid in enumerate(ids)}
    return sorted(rows, key=lambda r: order[r[0].id])


def ask_workspace(db: Session, user: User, question: str, history: list[tuple[str, str]]) -> dict:
    # Specific intents first ("Summarize my last meeting" must not fall into the generic recap).
    if LAST_MEETING.search(question):
        return _last_meeting(db, user)
    if UPCOMING.search(question):
        return _upcoming(db, user)
    if TASKS.search(question):
        return _open_tasks(db, user)
    if DECISIONS.search(question):
        return _decisions(db, user)
    if INITIATIVES.search(question):
        return _initiatives(db, user)
    if RECAP.search(question):
        return _recap(db, user)

    hits = _retrieve(db, user, question)
    if not hits:
        return {"answer": "I couldn't find anything about that in your meetings. Try different keywords.", "citations": []}
    lines = [
        Line(i, f"{seg.speaker.name if seg.speaker else 'Someone'} ({meeting.title})", seg.start_ms, seg.end_ms, seg.text)
        for i, (seg, meeting) in enumerate(hits)
    ]
    ctx = MeetingContext(title="All of the user's meetings", participants=[], lines=lines)
    draft = get_assistant().answer(ctx, question, history)
    cited = draft.line_indexes or list(range(min(3, len(hits))))
    return {
        "answer": draft.answer,
        "citations": [_citation(*hits[i]) for i in cited if i < len(hits)],
        "meetings": _meeting_refs([m for _, m in hits]),
    }
