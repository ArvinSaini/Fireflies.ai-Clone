"""/api/channels — Fireflies-style channels (#public / private) that organize meetings."""
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.api.deps import CurrentUser, DbSession
from app.models import Channel, MeetingChannel
from app.schemas.common import ChannelCount, ChannelCreate, ChannelOut, ChannelUpdate
from app.services.people import CHANNEL_COLORS, color_for

router = APIRouter(prefix="/channels", tags=["channels"])


def _owned(db, channel_id: int, owner_id: int) -> Channel:
    channel = db.scalar(select(Channel).where(Channel.id == channel_id, Channel.owner_id == owner_id))
    if channel is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Channel not found")
    return channel


def _ensure_unique(db, owner_id: int, name: str, exclude_id: int | None = None) -> None:
    """The DB constraint is case-sensitive; "#sales" and "#Sales" should still clash."""
    clash = db.scalar(select(Channel.id).where(
        Channel.owner_id == owner_id, func.lower(Channel.name) == name.lower(), Channel.id != (exclude_id or -1)))
    if clash:
        raise HTTPException(status.HTTP_409_CONFLICT, "A channel with that name already exists")


def _commit_or_conflict(db) -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "A channel with that name already exists") from None


@router.get("", response_model=list[ChannelCount])
def list_channels(db: DbSession, user: CurrentUser):
    rows = db.execute(
        select(Channel, func.count(MeetingChannel.meeting_id))
        .outerjoin(MeetingChannel)
        .where(Channel.owner_id == user.id)
        .group_by(Channel.id)
        .order_by(func.lower(Channel.name))
    ).all()
    return [ChannelCount(**ChannelOut.model_validate(c).model_dump(), meeting_count=n) for c, n in rows]


@router.post("", response_model=ChannelOut, status_code=status.HTTP_201_CREATED)
def create_channel(data: ChannelCreate, db: DbSession, user: CurrentUser):
    name = data.name.strip().lstrip("#").strip()
    _ensure_unique(db, user.id, name)
    channel = Channel(owner_id=user.id, name=name, description=data.description, is_private=data.is_private,
                      color=color_for(name, CHANNEL_COLORS))
    db.add(channel)
    _commit_or_conflict(db)
    return channel


@router.patch("/{channel_id}", response_model=ChannelOut)
def update_channel(channel_id: int, data: ChannelUpdate, db: DbSession, user: CurrentUser):
    channel = _owned(db, channel_id, user.id)
    if data.name is not None:
        channel.name = data.name.strip().lstrip("#").strip()
        _ensure_unique(db, user.id, channel.name, exclude_id=channel.id)
    if "description" in data.model_fields_set:
        channel.description = data.description
    if data.is_private is not None:
        channel.is_private = data.is_private
    _commit_or_conflict(db)
    return channel


@router.delete("/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_channel(channel_id: int, db: DbSession, user: CurrentUser):
    """Deleting a channel never deletes its meetings — they just leave the channel."""
    db.delete(_owned(db, channel_id, user.id))
    db.commit()
