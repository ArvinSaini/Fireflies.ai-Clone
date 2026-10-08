"""/api/topic-trackers — keyword groups counted in every meeting's Smart Search panel."""
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import CurrentUser, DbSession
from app.models import TopicTracker
from app.schemas.common import TopicTrackerIn, TopicTrackerOut
from app.services.people import CHANNEL_COLORS, color_for

router = APIRouter(prefix="/topic-trackers", tags=["topic trackers"])


def _clean(keywords: list[str]) -> list[str]:
    seen, out = set(), []
    for k in keywords:
        k = k.strip()
        if k and k.lower() not in seen:
            seen.add(k.lower())
            out.append(k)
    return out


@router.get("", response_model=list[TopicTrackerOut])
def list_trackers(db: DbSession, user: CurrentUser):
    return db.scalars(select(TopicTracker).where(TopicTracker.owner_id == user.id).order_by(TopicTracker.name)).all()


@router.post("", response_model=TopicTrackerOut, status_code=status.HTTP_201_CREATED)
def create_tracker(data: TopicTrackerIn, db: DbSession, user: CurrentUser):
    tracker = TopicTracker(owner_id=user.id, name=data.name.strip(), keywords=_clean(data.keywords),
                           color=color_for(data.name, CHANNEL_COLORS))
    db.add(tracker)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "A tracker with that name already exists") from None
    return tracker


@router.put("/{tracker_id}", response_model=TopicTrackerOut)
def update_tracker(tracker_id: int, data: TopicTrackerIn, db: DbSession, user: CurrentUser):
    tracker = db.scalar(select(TopicTracker).where(TopicTracker.id == tracker_id, TopicTracker.owner_id == user.id))
    if tracker is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Topic tracker not found")
    tracker.name, tracker.keywords = data.name.strip(), _clean(data.keywords)
    db.commit()
    return tracker


@router.delete("/{tracker_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tracker(tracker_id: int, db: DbSession, user: CurrentUser):
    tracker = db.scalar(select(TopicTracker).where(TopicTracker.id == tracker_id, TopicTracker.owner_id == user.id))
    if tracker is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Topic tracker not found")
    db.delete(tracker)
    db.commit()
