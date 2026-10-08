"""AskFred chat about a single meeting."""
from fastapi import APIRouter, status

from app.api.deps import DbSession, OwnedMeeting
from app.schemas.transcript import ChatAsk, ChatMessageOut
from app.services import chat

router = APIRouter(prefix="/meetings/{meeting_id}/chat", tags=["askfred"])


@router.get("", response_model=list[ChatMessageOut])
def get_history(meeting: OwnedMeeting, db: DbSession):
    return chat.history(db, meeting.id)


@router.post("", response_model=list[ChatMessageOut], status_code=status.HTTP_201_CREATED)
def ask(data: ChatAsk, meeting: OwnedMeeting, db: DbSession):
    """Returns the stored [question, answer] pair."""
    return list(chat.ask(db, meeting, data.question))


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def clear_history(meeting: OwnedMeeting, db: DbSession):
    chat.clear(db, meeting.id)
