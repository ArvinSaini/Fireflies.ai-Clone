"""Action items: per-meeting create, global listing (the "Tasks" view), update, delete."""
from typing import Literal

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from app.api.deps import CurrentUser, DbSession, OwnedMeeting
from app.models import ActionItem, Meeting, Participant, TranscriptSegment
from app.models.mixins import utcnow
from app.schemas.common import ActionItemOut, ActionItemWithMeeting
from app.schemas.transcript import ActionItemCreate, ActionItemUpdate

router = APIRouter(tags=["action items"])


def _get_item(db, item_id: int, owner_id: int) -> ActionItem:
    item = db.scalar(
        select(ActionItem).join(Meeting).where(ActionItem.id == item_id, Meeting.owner_id == owner_id)
    )
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Action item not found")
    return item


def _check_assignee(db, assignee_id: int | None) -> None:
    if assignee_id is not None and db.get(Participant, assignee_id) is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown assignee")


@router.get("/action-items", response_model=list[ActionItemWithMeeting])
def list_all_action_items(
    db: DbSession, user: CurrentUser, status_filter: Literal["all", "open", "completed"] = "all",
    assignee_id: int | None = None,
):
    stmt = select(ActionItem, Meeting).join(Meeting).where(Meeting.owner_id == user.id)
    if status_filter != "all":
        stmt = stmt.where(ActionItem.is_completed.is_(status_filter == "completed"))
    if assignee_id is not None:
        stmt = stmt.where(ActionItem.assignee_id == assignee_id)
    stmt = stmt.order_by(ActionItem.is_completed, Meeting.started_at.desc(), ActionItem.position)
    return [
        ActionItemWithMeeting(**ActionItemOut.model_validate(a).model_dump(),
                              meeting_title=m.title, meeting_started_at=m.started_at)
        for a, m in db.execute(stmt).all()
    ]


@router.post("/meetings/{meeting_id}/action-items", response_model=ActionItemOut, status_code=status.HTTP_201_CREATED)
def create_action_item(data: ActionItemCreate, meeting: OwnedMeeting, db: DbSession):
    _check_assignee(db, data.assignee_id)
    timestamp = data.timestamp_ms
    if data.segment_id is not None:
        seg = db.get(TranscriptSegment, data.segment_id)
        if seg is None or seg.meeting_id != meeting.id:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Segment does not belong to this meeting")
        timestamp = seg.start_ms if timestamp is None else timestamp
    position = (db.scalar(select(func.max(ActionItem.position)).where(ActionItem.meeting_id == meeting.id)) or 0) + 1
    item = ActionItem(
        meeting_id=meeting.id, text=data.text.strip(), assignee_id=data.assignee_id, due_date=data.due_date,
        segment_id=data.segment_id, timestamp_ms=timestamp, position=position, source="user",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/action-items/{item_id}", response_model=ActionItemOut)
def update_action_item(item_id: int, data: ActionItemUpdate, db: DbSession, user: CurrentUser):
    item = _get_item(db, item_id, user.id)
    fields = data.model_fields_set
    if data.text is not None:
        item.text = data.text.strip()
    if "assignee_id" in fields:
        _check_assignee(db, data.assignee_id)
        item.assignee_id = data.assignee_id
    if "due_date" in fields:
        item.due_date = data.due_date
    if data.position is not None:
        item.position = data.position
    if data.is_completed is not None and data.is_completed != item.is_completed:
        item.is_completed = data.is_completed
        item.completed_at = utcnow() if data.is_completed else None
    db.commit()
    db.refresh(item)
    return item


@router.delete("/action-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_action_item(item_id: int, db: DbSession, user: CurrentUser):
    db.delete(_get_item(db, item_id, user.id))
    db.commit()
