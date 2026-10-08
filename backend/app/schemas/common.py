from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserOut(ORMModel):
    id: int
    name: str
    email: str
    avatar_color: str


class ParticipantIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str | None = Field(default=None, max_length=255)


class ParticipantOut(ORMModel):
    id: int
    name: str
    email: str | None
    color: str


class MeetingParticipantOut(ParticipantOut):
    role: Literal["host", "attendee"] = "attendee"


class ChannelOut(ORMModel):
    id: int
    name: str
    description: str | None
    is_private: bool
    color: str


class ChannelCount(ChannelOut):
    meeting_count: int


class ChannelCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    description: str | None = Field(default=None, max_length=500)
    is_private: bool = False


class ChannelUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    description: str | None = Field(default=None, max_length=500)
    is_private: bool | None = None


class TopicTrackerIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    keywords: list[str] = Field(min_length=1, max_length=25)


class TopicTrackerOut(ORMModel):
    id: int
    name: str
    keywords: list[str]
    color: str


class ParticipantCount(ParticipantOut):
    meeting_count: int


class ActionItemOut(ORMModel):
    id: int
    meeting_id: int
    text: str
    is_completed: bool
    completed_at: datetime | None
    due_date: date | None
    timestamp_ms: int | None
    segment_id: int | None
    source: str
    position: int
    assignee: ParticipantOut | None
    created_at: datetime


class ActionItemWithMeeting(ActionItemOut):
    meeting_title: str
    meeting_started_at: datetime


class Page[T](BaseModel):
    items: list[T]
    total: int
    page: int
    page_size: int
