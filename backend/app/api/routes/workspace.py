"""Workspace-level endpoints: current user, stats, participants, tags, global search."""
from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import func, select

from app.api.deps import CurrentUser, DbSession
from app.core.config import get_settings
from app.models import Meeting, MeetingParticipant, MeetingTag, Participant, Tag
from app.schemas.common import ParticipantCount, TagCount, UserOut
from app.schemas.transcript import SearchResults
from app.services import meetings as meeting_service
from app.services.search import search

router = APIRouter(tags=["workspace"])


class WorkspaceStats(BaseModel):
    meeting_count: int
    total_duration_ms: int
    meetings_this_week: int
    action_items_total: int
    action_items_open: int
    participant_count: int
    ai_engine: str


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    return user


@router.get("/stats", response_model=WorkspaceStats)
def stats(db: DbSession, user: CurrentUser):
    engine = "llm" if get_settings().llm_enabled else "heuristic"
    return WorkspaceStats(**meeting_service.workspace_stats(db, user.id), ai_engine=engine)


@router.get("/participants", response_model=list[ParticipantCount])
def participants(db: DbSession, user: CurrentUser):
    rows = db.execute(
        select(Participant, func.count(MeetingParticipant.meeting_id))
        .join(MeetingParticipant).join(Meeting)
        .where(Meeting.owner_id == user.id)
        .group_by(Participant.id)
        .order_by(func.count(MeetingParticipant.meeting_id).desc(), Participant.name)
    ).all()
    return [ParticipantCount(id=p.id, name=p.name, email=p.email, color=p.color, meeting_count=n) for p, n in rows]


@router.get("/tags", response_model=list[TagCount])
def tags(db: DbSession, user: CurrentUser):
    rows = db.execute(
        select(Tag, func.count(MeetingTag.meeting_id))
        .join(MeetingTag).join(Meeting)
        .where(Meeting.owner_id == user.id)
        .group_by(Tag.id)
        .order_by(Tag.name)
    ).all()
    return [TagCount(id=t.id, name=t.name, color=t.color, meeting_count=n) for t, n in rows]


@router.get("/search", response_model=SearchResults)
def global_search(db: DbSession, user: CurrentUser, q: str = Query(..., min_length=1, max_length=200),
                  limit: int = Query(50, ge=1, le=200)):
    return search(db, user.id, q, limit)
