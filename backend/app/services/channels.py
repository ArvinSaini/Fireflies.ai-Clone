"""Channels (#public / private) that organize meetings, with case-insensitive unique names."""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Channel, MeetingChannel
from app.schemas.common import ChannelCreate, ChannelUpdate
from app.services.errors import Conflict, NotFound
from app.services.people import CHANNEL_COLORS, color_for

DUPLICATE = "A channel with that name already exists"


def _clean_name(name: str) -> str:
    return name.strip().lstrip("#").strip()


def get_owned(db: Session, channel_id: int, owner_id: int) -> Channel:
    channel = db.scalar(select(Channel).where(Channel.id == channel_id, Channel.owner_id == owner_id))
    if channel is None:
        raise NotFound("Channel not found")
    return channel


def _ensure_unique(db: Session, owner_id: int, name: str, exclude_id: int | None = None) -> None:
    """The DB constraint is case-sensitive; "#sales" and "#Sales" should still clash."""
    clash = db.scalar(select(Channel.id).where(
        Channel.owner_id == owner_id, func.lower(Channel.name) == name.lower(), Channel.id != (exclude_id or -1)))
    if clash:
        raise Conflict(DUPLICATE)


def _commit(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError:  # a concurrent insert won the race
        db.rollback()
        raise Conflict(DUPLICATE) from None


def list_with_counts(db: Session, owner_id: int) -> list[tuple[Channel, int]]:
    rows = db.execute(
        select(Channel, func.count(MeetingChannel.meeting_id))
        .outerjoin(MeetingChannel)
        .where(Channel.owner_id == owner_id)
        .group_by(Channel.id)
        .order_by(func.lower(Channel.name))
    ).all()
    return [(c, n) for c, n in rows]


def create(db: Session, owner_id: int, data: ChannelCreate) -> Channel:
    name = _clean_name(data.name)
    _ensure_unique(db, owner_id, name)
    channel = Channel(owner_id=owner_id, name=name, description=data.description, is_private=data.is_private,
                      color=color_for(name, CHANNEL_COLORS))
    db.add(channel)
    _commit(db)
    return channel


def update(db: Session, channel: Channel, data: ChannelUpdate) -> Channel:
    if data.name is not None:
        channel.name = _clean_name(data.name)
        _ensure_unique(db, channel.owner_id, channel.name, exclude_id=channel.id)
    if "description" in data.model_fields_set:
        channel.description = data.description
    if data.is_private is not None:
        channel.is_private = data.is_private
    _commit(db)
    return channel


def delete(db: Session, channel: Channel) -> None:
    """Deleting a channel never deletes its meetings — they just leave the channel (CASCADE on the link table)."""
    db.delete(channel)
    db.commit()
