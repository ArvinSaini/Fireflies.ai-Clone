"""Workspace-level schemas: current user, stats and workspace-wide AskFred."""
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import ParticipantOut, UserOut


class Me(UserOut):
    # The user's own participant record (used for "Hosted by me" / "My Tasks").
    participant: ParticipantOut | None


class WorkspaceStats(BaseModel):
    meeting_count: int
    total_duration_ms: int
    meetings_this_week: int
    action_items_total: int
    action_items_open: int
    participant_count: int
    ai_engine: Literal["llm", "heuristic"]


class Turn(BaseModel):
    role: Literal["user", "assistant"]
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
