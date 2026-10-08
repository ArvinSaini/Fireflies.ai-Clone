"""Transcript segment editing, comments, soundbites and bookmarks."""
from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession, OwnedMeeting
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
from app.services import transcript as svc

router = APIRouter(tags=["transcript"])


@router.patch("/segments/{segment_id}", response_model=SegmentOut)
def update_segment(segment_id: int, data: SegmentUpdate, db: DbSession, user: CurrentUser):
    """Fix a transcription mistake or re-assign the speaker of a line."""
    return svc.update_segment(db, user.id, segment_id, data)


# --- comments -----------------------------------------------------------------

@router.get("/meetings/{meeting_id}/comments", response_model=list[CommentOut])
def list_comments(meeting: OwnedMeeting, db: DbSession):
    return svc.list_comments(db, meeting)


@router.post("/meetings/{meeting_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
def create_comment(data: CommentCreate, meeting: OwnedMeeting, db: DbSession, user: CurrentUser):
    return svc.add_comment(db, meeting, user, data)


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(comment_id: int, db: DbSession, user: CurrentUser):
    svc.delete_comment(db, user.id, comment_id)


# --- soundbites ---------------------------------------------------------------

@router.get("/meetings/{meeting_id}/soundbites", response_model=list[SoundbiteOut])
def list_soundbites(meeting: OwnedMeeting, db: DbSession):
    return svc.list_soundbites(db, meeting)


@router.post("/meetings/{meeting_id}/soundbites", response_model=SoundbiteOut, status_code=status.HTTP_201_CREATED)
def create_soundbite(data: SoundbiteCreate, meeting: OwnedMeeting, db: DbSession):
    return svc.add_soundbite(db, meeting, data)


@router.delete("/soundbites/{soundbite_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_soundbite(soundbite_id: int, db: DbSession, user: CurrentUser):
    svc.delete_soundbite(db, user.id, soundbite_id)


# --- bookmarks ----------------------------------------------------------------

@router.get("/meetings/{meeting_id}/bookmarks", response_model=list[BookmarkOut])
def list_bookmarks(meeting: OwnedMeeting, db: DbSession, user: CurrentUser):
    return svc.list_bookmarks(db, meeting, user)


@router.post("/meetings/{meeting_id}/bookmarks", response_model=BookmarkOut, status_code=status.HTTP_201_CREATED)
def create_bookmark(data: BookmarkCreate, meeting: OwnedMeeting, db: DbSession, user: CurrentUser):
    return svc.add_bookmark(db, meeting, user, data)


@router.delete("/bookmarks/{bookmark_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bookmark(bookmark_id: int, db: DbSession, user: CurrentUser):
    svc.delete_bookmark(db, user, bookmark_id)
