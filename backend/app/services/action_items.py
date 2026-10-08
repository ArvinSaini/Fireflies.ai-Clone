"""Action items: the Tasks feed plus create / update / delete on a meeting's items."""
from __future__ import annotations

from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import ActionItem, Meeting, Participant, TranscriptSegment, User
from app.models.mixins import utcnow
from app.schemas.transcript import ActionItemCreate, ActionItemUpdate
from app.services.errors import InvalidInput, NotFound
from app.services.meetings import user_participant

StatusFilter = Literal["all", "open", "completed"]


def get_owned(db: Session, item_id: int, owner_id: int) -> ActionItem:
    item = db.scalar(select(ActionItem).join(Meeting).where(ActionItem.id == item_id, Meeting.owner_id == owner_id))
    if item is None:
        raise NotFound("Action item not found")
    return item


def _check_assignee(db: Session, assignee_id: int | None) -> None:
    if assignee_id is not None and db.get(Participant, assignee_id) is None:
        raise InvalidInput("Unknown assignee")


def list_for_user(
    db: Session, user: User, status: StatusFilter = "all", assignee_id: int | None = None, mine: bool = False,
) -> list[tuple[ActionItem, Meeting]]:
    """The Tasks feed across all meetings. `mine` = items assigned to the current user ("My Tasks")."""
    stmt = select(ActionItem, Meeting).join(Meeting).where(Meeting.owner_id == user.id)
    if mine:
        me = user_participant(db, user)
        stmt = stmt.where(ActionItem.assignee_id == (me.id if me else -1))
    if status != "all":
        stmt = stmt.where(ActionItem.is_completed.is_(status == "completed"))
    if assignee_id is not None:
        stmt = stmt.where(ActionItem.assignee_id == assignee_id)
    stmt = stmt.order_by(ActionItem.is_completed, Meeting.started_at.desc(), ActionItem.position)
    return [(a, m) for a, m in db.execute(stmt).all()]


def create(db: Session, meeting: Meeting, data: ActionItemCreate) -> ActionItem:
    _check_assignee(db, data.assignee_id)
    timestamp = data.timestamp_ms
    if data.segment_id is not None:
        seg = db.get(TranscriptSegment, data.segment_id)
        if seg is None or seg.meeting_id != meeting.id:
            raise InvalidInput("Segment does not belong to this meeting")
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


def update(db: Session, item: ActionItem, data: ActionItemUpdate) -> ActionItem:
    """Partial update; only fields present in the request are touched (so `assignee_id: null` unassigns)."""
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


def delete(db: Session, item: ActionItem) -> None:
    db.delete(item)
    db.commit()
