"""Action items: per-meeting create, global listing (the "Tasks" view), update, delete."""
from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession, OwnedMeeting
from app.schemas.common import ActionItemOut, ActionItemWithMeeting
from app.schemas.transcript import ActionItemCreate, ActionItemUpdate
from app.services import action_items as svc

router = APIRouter(tags=["action items"])


@router.get("/action-items", response_model=list[ActionItemWithMeeting])
def list_all_action_items(
    db: DbSession, user: CurrentUser, status_filter: svc.StatusFilter = "all",
    assignee_id: int | None = None, mine: bool = False,
):
    """The Tasks feed. `mine=true` = "My Tasks" (assigned to the current user)."""
    return [
        ActionItemWithMeeting(**ActionItemOut.model_validate(a).model_dump(),
                              meeting_title=m.title, meeting_started_at=m.started_at)
        for a, m in svc.list_for_user(db, user, status_filter, assignee_id, mine)
    ]


@router.post("/meetings/{meeting_id}/action-items", response_model=ActionItemOut, status_code=status.HTTP_201_CREATED)
def create_action_item(data: ActionItemCreate, meeting: OwnedMeeting, db: DbSession):
    return svc.create(db, meeting, data)


@router.patch("/action-items/{item_id}", response_model=ActionItemOut)
def update_action_item(item_id: int, data: ActionItemUpdate, db: DbSession, user: CurrentUser):
    return svc.update(db, svc.get_owned(db, item_id, user.id), data)


@router.delete("/action-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_action_item(item_id: int, db: DbSession, user: CurrentUser):
    svc.delete(db, svc.get_owned(db, item_id, user.id))
