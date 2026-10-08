"""Workspace-level endpoints: current user, stats, participants, global search."""
from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbSession
from app.schemas.common import ParticipantCount, ParticipantOut, UserOut
from app.schemas.transcript import SearchResults
from app.schemas.workspace import Me, WorkspaceStats
from app.services import meetings as meeting_service
from app.services.ai import engine_name
from app.services.people import participants_with_counts
from app.services.search import search

router = APIRouter(tags=["workspace"])


@router.get("/me", response_model=Me)
def me(db: DbSession, user: CurrentUser):
    participant = meeting_service.user_participant(db, user)
    return Me(**UserOut.model_validate(user).model_dump(),
              participant=ParticipantOut.model_validate(participant) if participant else None)


@router.get("/stats", response_model=WorkspaceStats)
def stats(db: DbSession, user: CurrentUser):
    return WorkspaceStats(**meeting_service.workspace_stats(db, user.id), ai_engine=engine_name())


@router.get("/participants", response_model=list[ParticipantCount])
def participants(db: DbSession, user: CurrentUser, role: str | None = Query(None, pattern="^(host|attendee)$")):
    """People in the user's meetings; `role=host` lists only people who hosted (Filters → Hosted by)."""
    return [ParticipantCount(id=p.id, name=p.name, email=p.email, color=p.color, meeting_count=n)
            for p, n in participants_with_counts(db, user.id, role)]


@router.get("/search", response_model=SearchResults)
def global_search(db: DbSession, user: CurrentUser, q: str = Query(..., min_length=1, max_length=200),
                  limit: int = Query(50, ge=1, le=200)):
    return search(db, user.id, q, limit)
