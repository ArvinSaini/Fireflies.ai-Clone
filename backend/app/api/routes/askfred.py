"""/api/askfred — AskFred across all meetings (the global AskFred page)."""
from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.workspace import WorkspaceAnswer, WorkspaceQuestion
from app.services.workspace_assistant import ask_workspace

router = APIRouter(prefix="/askfred", tags=["askfred"])


@router.post("", response_model=WorkspaceAnswer)
def ask(data: WorkspaceQuestion, db: DbSession, user: CurrentUser):
    """Stateless: the client sends recent turns as `history` for follow-up questions."""
    return ask_workspace(db, user, data.question, [(t.role, t.content) for t in data.history])
