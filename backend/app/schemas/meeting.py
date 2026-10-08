from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import ActionItemOut, MeetingParticipantOut, ORMModel, ParticipantIn, ParticipantOut, TagOut

Platform = Literal["zoom", "google_meet", "teams", "upload", "paste", "manual"]
TranscriptFormat = Literal["auto", "txt", "vtt", "srt", "json"]
SortKey = Literal["recent", "oldest", "longest", "shortest", "title"]


class NoteSection(BaseModel):
    heading: str
    start_ms: int | None = None
    bullets: list[str]


class SummaryOut(ORMModel):
    overview: str
    keywords: list[str]
    notes: list[NoteSection]
    generated_by: str
    updated_at: datetime


class SummaryUpdate(BaseModel):
    overview: str | None = None
    keywords: list[str] | None = None
    notes: list[NoteSection] | None = None


class ChapterOut(ORMModel):
    id: int
    title: str
    description: str
    start_ms: int
    end_ms: int


class MeetingListItem(BaseModel):
    id: int
    title: str
    started_at: datetime
    duration_ms: int
    platform: str
    participants: list[MeetingParticipantOut]
    tags: list[TagOut]
    overview: str | None
    action_items_total: int
    action_items_open: int


class MeetingDetail(BaseModel):
    id: int
    title: str
    description: str | None
    started_at: datetime
    duration_ms: int
    platform: str
    media_url: str | None
    created_at: datetime
    updated_at: datetime
    participants: list[MeetingParticipantOut]
    tags: list[TagOut]
    summary: SummaryOut | None
    chapters: list[ChapterOut]
    action_items: list[ActionItemOut]
    segment_count: int
    comment_count: int


class MeetingCreate(BaseModel):
    """Create a meeting from a form, optionally with pasted transcript text."""

    title: str = Field(min_length=1, max_length=255)
    started_at: datetime | None = None
    platform: Platform = "manual"
    description: str | None = None
    participants: list[ParticipantIn] = []
    tags: list[str] = []
    transcript_text: str | None = None
    transcript_format: TranscriptFormat = "auto"
    duration_minutes: int | None = Field(default=None, ge=0, le=24 * 60)
    generate_summary: bool = True


class MeetingUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    started_at: datetime | None = None
    description: str | None = None
    participants: list[ParticipantIn] | None = None
    tags: list[str] | None = None


class SpeakerStat(BaseModel):
    participant: ParticipantOut | None
    talk_ms: int
    talk_percent: float
    segment_count: int
    word_count: int
    words_per_minute: int


class MeetingAnalytics(BaseModel):
    speakers: list[SpeakerStat]
    # Fireflies-style "AI filters": segment ids per category.
    filters: dict[str, list[int]]
    total_words: int
    question_count: int


__all__ = [
    "ChapterOut", "MeetingAnalytics", "MeetingCreate", "MeetingDetail", "MeetingListItem", "MeetingUpdate",
    "NoteSection", "Platform", "SortKey", "SpeakerStat", "SummaryOut", "SummaryUpdate",
    "TranscriptFormat",
]
