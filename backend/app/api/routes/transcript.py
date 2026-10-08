"""Transcript segment editing, comments, soundbites and bookmarks."""
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession, OwnedMeeting
from app.models import Bookmark, Comment, Meeting, MeetingParticipant, Soundbite, TranscriptSegment
from app.schemas.transcript import (
    BookmarkCreate,
    BookmarkOut,
    CommentCreate,
    CommentOut,
    SegmentOut,
    SegmentUpdate,
    SoundbiteCreate,
    SoundbiteOut,
)
from app.services.people import get_or_create_participant

router = APIRouter(tags=["transcript"])


def _owned_segment(db, segment_id: int, owner_id: int) -> TranscriptSegment:
    seg = db.scalar(
        select(TranscriptSegment).join(Meeting).where(TranscriptSegment.id == segment_id, Meeting.owner_id == owner_id)
    )
    if seg is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Segment not found")
    return seg


@router.patch("/segments/{segment_id}", response_model=SegmentOut)
def update_segment(segment_id: int, data: SegmentUpdate, db: DbSession, user: CurrentUser):
    """Fix a transcription mistake or re-assign the speaker of a line."""
    seg = _owned_segment(db, segment_id, user.id)
    if data.text is not None:
        seg.text = data.text.strip()
    if data.speaker_name is not None:
        speaker = get_or_create_participant(db, data.speaker_name)
        seg.participant_id = speaker.id
        exists = db.scalar(select(MeetingParticipant).where(
            MeetingParticipant.meeting_id == seg.meeting_id, MeetingParticipant.participant_id == speaker.id))
        if exists is None:
            db.add(MeetingParticipant(meeting_id=seg.meeting_id, participant_id=speaker.id))
    db.commit()
    db.refresh(seg)
    return seg


# --- comments -----------------------------------------------------------------

@router.get("/meetings/{meeting_id}/comments", response_model=list[CommentOut])
def list_comments(meeting: OwnedMeeting, db: DbSession):
    return db.scalars(select(Comment).where(Comment.meeting_id == meeting.id).order_by(Comment.created_at)).all()


@router.post("/meetings/{meeting_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
def create_comment(data: CommentCreate, meeting: OwnedMeeting, db: DbSession, user: CurrentUser):
    seg = db.get(TranscriptSegment, data.segment_id)
    if seg is None or seg.meeting_id != meeting.id:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Segment does not belong to this meeting")
    comment = Comment(meeting_id=meeting.id, segment_id=seg.id, author_id=user.id, body=data.body.strip())
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(comment_id: int, db: DbSession, user: CurrentUser):
    comment = db.scalar(select(Comment).join(Meeting).where(Comment.id == comment_id, Meeting.owner_id == user.id))
    if comment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Comment not found")
    db.delete(comment)
    db.commit()


# --- soundbites ---------------------------------------------------------------

@router.get("/meetings/{meeting_id}/soundbites", response_model=list[SoundbiteOut])
def list_soundbites(meeting: OwnedMeeting, db: DbSession):
    return db.scalars(select(Soundbite).where(Soundbite.meeting_id == meeting.id).order_by(Soundbite.start_ms)).all()


@router.post("/meetings/{meeting_id}/soundbites", response_model=SoundbiteOut, status_code=status.HTTP_201_CREATED)
def create_soundbite(data: SoundbiteCreate, meeting: OwnedMeeting, db: DbSession):
    if data.end_ms <= data.start_ms:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "end_ms must be after start_ms")
    if data.segment_id is not None:
        seg = db.get(TranscriptSegment, data.segment_id)
        if seg is None or seg.meeting_id != meeting.id:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Segment does not belong to this meeting")
    bite = Soundbite(meeting_id=meeting.id, **data.model_dump())
    db.add(bite)
    db.commit()
    db.refresh(bite)
    return bite


@router.delete("/soundbites/{soundbite_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_soundbite(soundbite_id: int, db: DbSession, user: CurrentUser):
    bite = db.scalar(select(Soundbite).join(Meeting).where(Soundbite.id == soundbite_id, Meeting.owner_id == user.id))
    if bite is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Soundbite not found")
    db.delete(bite)
    db.commit()


# --- bookmarks ----------------------------------------------------------------

@router.get("/meetings/{meeting_id}/bookmarks", response_model=list[BookmarkOut])
def list_bookmarks(meeting: OwnedMeeting, db: DbSession, user: CurrentUser):
    return db.scalars(
        select(Bookmark).where(Bookmark.meeting_id == meeting.id, Bookmark.user_id == user.id).order_by(Bookmark.id)
    ).all()


@router.post("/meetings/{meeting_id}/bookmarks", response_model=BookmarkOut, status_code=status.HTTP_201_CREATED)
def create_bookmark(data: BookmarkCreate, meeting: OwnedMeeting, db: DbSession, user: CurrentUser):
    seg = db.get(TranscriptSegment, data.segment_id)
    if seg is None or seg.meeting_id != meeting.id:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Segment does not belong to this meeting")
    existing = db.scalar(select(Bookmark).where(Bookmark.segment_id == seg.id, Bookmark.user_id == user.id))
    if existing:  # idempotent: bookmarking twice is a no-op
        return existing
    bookmark = Bookmark(meeting_id=meeting.id, segment_id=seg.id, user_id=user.id)
    db.add(bookmark)
    db.commit()
    db.refresh(bookmark)
    return bookmark


@router.delete("/bookmarks/{bookmark_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bookmark(bookmark_id: int, db: DbSession, user: CurrentUser):
    bookmark = db.scalar(select(Bookmark).where(Bookmark.id == bookmark_id, Bookmark.user_id == user.id))
    if bookmark is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bookmark not found")
    db.delete(bookmark)
    db.commit()
