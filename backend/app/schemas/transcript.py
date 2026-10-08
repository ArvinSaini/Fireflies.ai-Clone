from datetime import date, datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel, ParticipantOut, UserOut


class SegmentOut(ORMModel):
    id: int
    position: int
    start_ms: int
    end_ms: int
    text: str
    speaker: ParticipantOut | None


class SegmentUpdate(BaseModel):
    text: str | None = Field(default=None, min_length=1)
    # Re-assign the line to a different speaker (created if new).
    speaker_name: str | None = Field(default=None, min_length=1, max_length=120)


class CommentCreate(BaseModel):
    segment_id: int
    body: str = Field(min_length=1, max_length=4000)


class CommentOut(ORMModel):
    id: int
    meeting_id: int
    segment_id: int
    body: str
    created_at: datetime
    author: UserOut


class SoundbiteCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    start_ms: int = Field(ge=0)
    end_ms: int = Field(gt=0)
    segment_id: int | None = None


class SoundbiteOut(ORMModel):
    id: int
    meeting_id: int
    segment_id: int | None
    title: str
    start_ms: int
    end_ms: int
    created_at: datetime


class ActionItemCreate(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    assignee_id: int | None = None
    due_date: date | None = None
    timestamp_ms: int | None = Field(default=None, ge=0)
    segment_id: int | None = None


class ActionItemUpdate(BaseModel):
    text: str | None = Field(default=None, min_length=1, max_length=2000)
    assignee_id: int | None = None
    due_date: date | None = None
    is_completed: bool | None = None
    position: int | None = None


class ChatCitation(BaseModel):
    segment_id: int
    start_ms: int
    speaker: str | None
    text: str


class ChatMessageOut(ORMModel):
    id: int
    role: str
    content: str
    citations: list[ChatCitation]
    created_at: datetime


class BookmarkCreate(BaseModel):
    segment_id: int


class BookmarkOut(ORMModel):
    id: int
    meeting_id: int
    segment_id: int
    created_at: datetime


class ChatAsk(BaseModel):
    question: str = Field(min_length=1, max_length=2000)


class SearchHit(BaseModel):
    meeting_id: int
    meeting_title: str
    meeting_started_at: datetime
    segment_id: int | None
    start_ms: int | None
    speaker: str | None
    snippet: str  # contains <mark>…</mark> around matched terms
    kind: str  # title | transcript


class SearchResults(BaseModel):
    query: str
    total: int
    hits: list[SearchHit]
