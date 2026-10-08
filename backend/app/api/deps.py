"""Shared FastAPI dependencies."""
from typing import Annotated

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Meeting, User
from app.services import meetings as meeting_service

DbSession = Annotated[Session, Depends(get_db)]

DEFAULT_USER_ID = 1


def current_user(db: DbSession) -> User:
    """Auth is out of scope: every request acts as the default workspace user.
    Swapping this for real auth (e.g. a JWT/session lookup) touches only this function."""
    user = db.scalar(select(User).where(User.id == DEFAULT_USER_ID))
    if user is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Workspace not initialised (run the seed).")
    return user


CurrentUser = Annotated[User, Depends(current_user)]


def owned_meeting(meeting_id: int, db: DbSession, user: CurrentUser) -> Meeting:
    try:
        return meeting_service.get_meeting(db, meeting_id, user.id)
    except meeting_service.NotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meeting not found") from None


OwnedMeeting = Annotated[Meeting, Depends(owned_meeting)]
