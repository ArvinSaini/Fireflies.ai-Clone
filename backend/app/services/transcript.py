"""Transcript lines and what users attach to them: edits, comments, soundbites, bookmarks."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Bookmark, Comment, Meeting, MeetingParticipant, Soundbite, TranscriptSegment, User
from app.schemas.transcript import BookmarkCreate, CommentCreate, SegmentUpdate, SoundbiteCreate
from app.services.errors import InvalidInput, NotFound
from app.services.people import get_or_create_participant


def segments(db: Session, meeting_id: int) -> list[TranscriptSegment]:
    return list(db.scalars(
        select(TranscriptSegment).where(TranscriptSegment.meeting_id == meeting_id).order_by(TranscriptSegment.position)
    ))


def _segment_in(db: Session, meeting: Meeting, segment_id: int) -> TranscriptSegment:
    """A segment referenced by a request must belong to the meeting in the URL."""
    seg = db.get(TranscriptSegment, segment_id)
    if seg is None or seg.meeting_id != meeting.id:
        raise InvalidInput("Segment does not belong to this meeting")
    return seg


def _owned(db: Session, model, obj_id: int, owner_id: int, label: str):
    obj = db.scalar(select(model).join(Meeting).where(model.id == obj_id, Meeting.owner_id == owner_id))
    if obj is None:
        raise NotFound(f"{label} not found")
    return obj


def _save(db: Session, obj):
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def _delete(db: Session, obj) -> None:
    db.delete(obj)
    db.commit()


# --- segments -----------------------------------------------------------------

def update_segment(db: Session, owner_id: int, segment_id: int, data: SegmentUpdate) -> TranscriptSegment:
    """Fix a transcription mistake or re-assign the speaker of a line."""
    seg = _owned(db, TranscriptSegment, segment_id, owner_id, "Segment")
    if data.text is not None:
        seg.text = data.text.strip()
    if data.speaker_name is not None:
        speaker = get_or_create_participant(db, data.speaker_name)
        seg.participant_id = speaker.id
        linked = db.scalar(select(MeetingParticipant).where(
            MeetingParticipant.meeting_id == seg.meeting_id, MeetingParticipant.participant_id == speaker.id))
        if linked is None:  # a new speaker becomes a meeting participant
            db.add(MeetingParticipant(meeting_id=seg.meeting_id, participant_id=speaker.id))
    return _save(db, seg)


# --- comments -----------------------------------------------------------------

def list_comments(db: Session, meeting: Meeting) -> list[Comment]:
    return list(db.scalars(select(Comment).where(Comment.meeting_id == meeting.id).order_by(Comment.created_at)))


def add_comment(db: Session, meeting: Meeting, user: User, data: CommentCreate) -> Comment:
    seg = _segment_in(db, meeting, data.segment_id)
    return _save(db, Comment(meeting_id=meeting.id, segment_id=seg.id, author_id=user.id, body=data.body.strip()))


def delete_comment(db: Session, owner_id: int, comment_id: int) -> None:
    _delete(db, _owned(db, Comment, comment_id, owner_id, "Comment"))


# --- soundbites ---------------------------------------------------------------

def list_soundbites(db: Session, meeting: Meeting) -> list[Soundbite]:
    return list(db.scalars(select(Soundbite).where(Soundbite.meeting_id == meeting.id).order_by(Soundbite.start_ms)))


def add_soundbite(db: Session, meeting: Meeting, data: SoundbiteCreate) -> Soundbite:
    if data.end_ms <= data.start_ms:
        raise InvalidInput("end_ms must be after start_ms")
    if data.segment_id is not None:
        _segment_in(db, meeting, data.segment_id)
    return _save(db, Soundbite(meeting_id=meeting.id, **data.model_dump()))


def delete_soundbite(db: Session, owner_id: int, soundbite_id: int) -> None:
    _delete(db, _owned(db, Soundbite, soundbite_id, owner_id, "Soundbite"))


# --- bookmarks (private to the user) --------------------------------------------

def list_bookmarks(db: Session, meeting: Meeting, user: User) -> list[Bookmark]:
    return list(db.scalars(
        select(Bookmark).where(Bookmark.meeting_id == meeting.id, Bookmark.user_id == user.id).order_by(Bookmark.id)
    ))


def add_bookmark(db: Session, meeting: Meeting, user: User, data: BookmarkCreate) -> Bookmark:
    seg = _segment_in(db, meeting, data.segment_id)
    existing = db.scalar(select(Bookmark).where(Bookmark.segment_id == seg.id, Bookmark.user_id == user.id))
    if existing:  # idempotent: bookmarking twice is a no-op
        return existing
    return _save(db, Bookmark(meeting_id=meeting.id, segment_id=seg.id, user_id=user.id))


def delete_bookmark(db: Session, user: User, bookmark_id: int) -> None:
    bookmark = db.scalar(select(Bookmark).where(Bookmark.id == bookmark_id, Bookmark.user_id == user.id))
    if bookmark is None:
        raise NotFound("Bookmark not found")
    _delete(db, bookmark)
