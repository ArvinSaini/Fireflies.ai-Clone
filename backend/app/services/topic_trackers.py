"""Topic trackers: named keyword groups counted in every meeting's Smart Search panel."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import TopicTracker
from app.schemas.common import TopicTrackerIn
from app.services.errors import Conflict, NotFound
from app.services.people import CHANNEL_COLORS, color_for


def clean_keywords(keywords: list[str]) -> list[str]:
    """Trim, drop blanks and de-duplicate case-insensitively, keeping first spelling and order."""
    seen, out = set(), []
    for k in keywords:
        k = k.strip()
        if k and k.lower() not in seen:
            seen.add(k.lower())
            out.append(k)
    return out


def list_for_owner(db: Session, owner_id: int) -> list[TopicTracker]:
    return list(db.scalars(select(TopicTracker).where(TopicTracker.owner_id == owner_id).order_by(TopicTracker.name)))


def get_owned(db: Session, tracker_id: int, owner_id: int) -> TopicTracker:
    tracker = db.scalar(select(TopicTracker).where(TopicTracker.id == tracker_id, TopicTracker.owner_id == owner_id))
    if tracker is None:
        raise NotFound("Topic tracker not found")
    return tracker


def _commit(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise Conflict("A tracker with that name already exists") from None


def create(db: Session, owner_id: int, data: TopicTrackerIn) -> TopicTracker:
    tracker = TopicTracker(owner_id=owner_id, name=data.name.strip(), keywords=clean_keywords(data.keywords),
                           color=color_for(data.name, CHANNEL_COLORS))
    db.add(tracker)
    _commit(db)
    return tracker


def update(db: Session, tracker: TopicTracker, data: TopicTrackerIn) -> TopicTracker:
    tracker.name, tracker.keywords = data.name.strip(), clean_keywords(data.keywords)
    _commit(db)
    return tracker


def delete(db: Session, tracker: TopicTracker) -> None:
    db.delete(tracker)
    db.commit()
