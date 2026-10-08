"""/api/channels — Fireflies-style channels (#public / private) that organize meetings."""
from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.common import ChannelCount, ChannelCreate, ChannelOut, ChannelUpdate
from app.services import channels as svc

router = APIRouter(prefix="/channels", tags=["channels"])


@router.get("", response_model=list[ChannelCount])
def list_channels(db: DbSession, user: CurrentUser):
    return [ChannelCount(**ChannelOut.model_validate(c).model_dump(), meeting_count=n)
            for c, n in svc.list_with_counts(db, user.id)]


@router.post("", response_model=ChannelOut, status_code=status.HTTP_201_CREATED)
def create_channel(data: ChannelCreate, db: DbSession, user: CurrentUser):
    return svc.create(db, user.id, data)


@router.patch("/{channel_id}", response_model=ChannelOut)
def update_channel(channel_id: int, data: ChannelUpdate, db: DbSession, user: CurrentUser):
    return svc.update(db, svc.get_owned(db, channel_id, user.id), data)


@router.delete("/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_channel(channel_id: int, db: DbSession, user: CurrentUser):
    """Deleting a channel never deletes its meetings — they just leave the channel."""
    svc.delete(db, svc.get_owned(db, channel_id, user.id))
