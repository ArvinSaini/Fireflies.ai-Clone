"""/api/askfred — AskFred across all meetings (the global AskFred page)."""
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.api.deps import CurrentUser, DbSession
from app.services.workspace_assistant import ask_workspace

router = APIRouter(prefix="/askfred", tags=["askfred"])


class Turn(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str


class WorkspaceQuestion(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    history: list[Turn] = Field(default=[], max_length=20)


class WorkspaceCitation(BaseModel):
    meeting_id: int
    meeting_title: str
    segment_id: int
    start_ms: int
    speaker: str | None
    text: str


class MeetingRef(BaseModel):
    meeting_id: int
    meeting_title: str
    started_at: str


class WorkspaceAnswer(BaseModel):
    answer: str
    citations: list[WorkspaceCitation]
    meetings: list[MeetingRef] = []


@router.post("", response_model=WorkspaceAnswer)
def ask(data: WorkspaceQuestion, db: DbSession, user: CurrentUser):
    """Stateless: the client sends recent turns as `history` for follow-up questions."""
    return ask_workspace(db, user, data.question, [(t.role, t.content) for t in data.history])
