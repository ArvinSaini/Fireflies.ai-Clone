"""/api/meetings — library listing, CRUD, transcript, summary, analytics and export."""
from datetime import date, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, File, Form, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession, OwnedMeeting
from app.api.presenters import meeting_detail, meeting_list_item
from app.models import TopicTracker, TranscriptSegment
from app.schemas.common import Page
from app.schemas.meeting import (
    BulkMeetingAction,
    MeetingAnalytics,
    MeetingCreate,
    MeetingDetail,
    MeetingListItem,
    MeetingUpdate,
    SortKey,
    SummaryOut,
    SummaryUpdate,
    TranscriptFormat,
)
from app.schemas.transcript import SegmentOut
from app.services import export as export_service
from app.services import meetings as svc
from app.services.insights import meeting_analytics
from app.services.transcript_parser import TranscriptParseError, parse_transcript

router = APIRouter(prefix="/meetings", tags=["meetings"])

MAX_UPLOAD_BYTES = 5 * 1024 * 1024


def _detail(db, meeting) -> MeetingDetail:
    return meeting_detail(meeting, *svc.meeting_counts(db, meeting.id))


def _create(db, user, data: MeetingCreate, parsed, **source) -> MeetingDetail:
    try:
        meeting = svc.create_meeting(db, user, data, parsed, **source)
    except svc.InvalidChannel as exc:
        db.rollback()
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from None
    return _detail(db, meeting)


def _segments(db, meeting_id: int) -> list[TranscriptSegment]:
    return list(db.scalars(
        select(TranscriptSegment).where(TranscriptSegment.meeting_id == meeting_id).order_by(TranscriptSegment.position)
    ))


@router.get("", response_model=Page[MeetingListItem])
def list_meetings(
    db: DbSession,
    user: CurrentUser,
    q: str | None = Query(None, description="Matches title or participant name/email"),
    scope: Literal["all", "mine", "shared"] = Query("all", description="'mine' = hosted by me, 'shared' = attended"),
    host_id: Annotated[list[int] | None, Query()] = None,
    participant_id: Annotated[list[int] | None, Query()] = None,
    channel_id: Annotated[list[int] | None, Query()] = None,
    platform: Annotated[list[str] | None, Query(description="Captured from")] = None,
    date_from: date | None = None,
    date_to: date | None = None,
    min_duration: int | None = Query(None, ge=0, description="minutes"),
    max_duration: int | None = Query(None, ge=1, description="minutes (exclusive)"),
    sort: SortKey = "recent",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    filters = svc.MeetingFilters(
        q=q, scope=scope, host_ids=host_id or [], participant_ids=participant_id or [], channel_ids=channel_id or [],
        platforms=platform or [], date_from=date_from, date_to=date_to,
        min_duration_min=min_duration, max_duration_min=max_duration, sort=sort,
    )
    rows, total = svc.list_meetings(db, user, filters, page, page_size)
    return Page(items=[meeting_list_item(m, t, o) for m, t, o in rows], total=total, page=page, page_size=page_size)


@router.post("", response_model=MeetingDetail, status_code=status.HTTP_201_CREATED)
def create_meeting(data: MeetingCreate, db: DbSession, user: CurrentUser):
    """Create from a form; include `transcript_text` to paste a transcript."""
    parsed = None
    if data.transcript_text and data.transcript_text.strip():
        try:
            parsed = parse_transcript(data.transcript_text, data.transcript_format)
        except TranscriptParseError as exc:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from None
        if data.platform == "manual":
            data.platform = "paste"
    return _create(db, user, data, parsed)


@router.post("/upload", response_model=MeetingDetail, status_code=status.HTTP_201_CREATED)
async def upload_meeting(
    db: DbSession,
    user: CurrentUser,
    file: UploadFile = File(..., description=".txt, .vtt, .srt or .json transcript"),
    title: str | None = Form(None),
    started_at: datetime | None = Form(None),
    participants: str | None = Form(None, description="Comma-separated names"),
    channel_ids: str | None = Form(None, description="Comma-separated channel ids"),
    language: str = Form("English (Global)"),
    transcript_format: TranscriptFormat = Form("auto"),
):
    raw = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "Transcript file must be under 5 MB")
    try:
        content = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "File must be UTF-8 text") from None
    try:
        parsed = parse_transcript(content, transcript_format, file.filename)
    except TranscriptParseError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from None

    default_title = (file.filename or "Uploaded meeting").rsplit(".", 1)[0].replace("_", " ").replace("-", " ").strip()
    data = MeetingCreate(
        title=(title or default_title or "Uploaded meeting")[:255],
        started_at=started_at,
        platform="upload",
        language=language,
        participants=[{"name": n.strip()} for n in (participants or "").split(",") if n.strip()],
        channel_ids=[int(c) for c in (channel_ids or "").split(",") if c.strip().isdigit()],
    )
    return _create(db, user, data, parsed, source_filename=file.filename, source_size_bytes=len(raw))


@router.post("/bulk")
def bulk_action(data: BulkMeetingAction, db: DbSession, user: CurrentUser):
    """Delete or move (re-channel) several meetings selected in the Notebook."""
    try:
        affected = svc.bulk_action(db, user.id, data.action, data.meeting_ids, data.channel_ids)
    except svc.InvalidChannel as exc:
        db.rollback()
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from None
    return {"affected": affected}


@router.get("/{meeting_id}", response_model=MeetingDetail)
def get_meeting(meeting: OwnedMeeting, db: DbSession):
    return _detail(db, meeting)


@router.patch("/{meeting_id}", response_model=MeetingDetail)
def update_meeting(data: MeetingUpdate, meeting: OwnedMeeting, db: DbSession):
    try:
        return _detail(db, svc.update_meeting(db, meeting, data))
    except svc.InvalidChannel as exc:
        db.rollback()
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from None


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meeting(meeting: OwnedMeeting, db: DbSession):
    svc.delete_meeting(db, meeting)


@router.get("/{meeting_id}/transcript", response_model=list[SegmentOut])
def get_transcript(meeting: OwnedMeeting, db: DbSession):
    return _segments(db, meeting.id)


@router.get("/{meeting_id}/analytics", response_model=MeetingAnalytics)
def get_analytics(meeting: OwnedMeeting, db: DbSession):
    trackers = db.scalars(select(TopicTracker).where(TopicTracker.owner_id == meeting.owner_id).order_by(TopicTracker.name))
    return meeting_analytics(_segments(db, meeting.id), list(trackers))


@router.post("/{meeting_id}/summary/regenerate", response_model=MeetingDetail)
def regenerate_summary(meeting: OwnedMeeting, db: DbSession):
    """Re-run the AI pipeline (summary, chapters, AI action items) on the current transcript."""
    if not _segments(db, meeting.id):
        raise HTTPException(status.HTTP_409_CONFLICT, "Meeting has no transcript to summarize")
    svc.summarize_meeting(db, meeting)
    return _detail(db, svc.get_meeting(db, meeting.id, meeting.owner_id))


@router.patch("/{meeting_id}/summary", response_model=SummaryOut)
def edit_summary(data: SummaryUpdate, meeting: OwnedMeeting, db: DbSession):
    notes = [n.model_dump() for n in data.notes] if data.notes is not None else None
    return svc.update_summary(db, meeting, data.overview, data.keywords, notes)


@router.get("/{meeting_id}/export")
def export_meeting(meeting: OwnedMeeting, db: DbSession, format: Literal["md", "txt", "json"] = "md"):
    render, media_type = export_service.EXPORTERS[format]
    body = render(meeting, _segments(db, meeting.id))
    slug = "".join(c if c.isalnum() else "-" for c in meeting.title.lower()).strip("-")[:60] or "meeting"
    return Response(
        body, media_type=f"{media_type}; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{slug}.{format}"'},
    )

