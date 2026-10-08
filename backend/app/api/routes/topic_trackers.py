"""/api/topic-trackers — keyword groups counted in every meeting's Smart Search panel."""
from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.common import TopicTrackerIn, TopicTrackerOut
from app.services import topic_trackers as svc

router = APIRouter(prefix="/topic-trackers", tags=["topic trackers"])


@router.get("", response_model=list[TopicTrackerOut])
def list_trackers(db: DbSession, user: CurrentUser):
    return svc.list_for_owner(db, user.id)


@router.post("", response_model=TopicTrackerOut, status_code=status.HTTP_201_CREATED)
def create_tracker(data: TopicTrackerIn, db: DbSession, user: CurrentUser):
    return svc.create(db, user.id, data)


@router.put("/{tracker_id}", response_model=TopicTrackerOut)
def update_tracker(tracker_id: int, data: TopicTrackerIn, db: DbSession, user: CurrentUser):
    return svc.update(db, svc.get_owned(db, tracker_id, user.id), data)


@router.delete("/{tracker_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tracker(tracker_id: int, db: DbSession, user: CurrentUser):
    svc.delete(db, svc.get_owned(db, tracker_id, user.id))
