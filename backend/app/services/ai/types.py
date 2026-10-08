"""Engine-agnostic data types shared by the heuristic and LLM implementations."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol


@dataclass(frozen=True)
class Line:
    """A transcript line as the AI layer sees it (decoupled from the ORM)."""

    index: int
    speaker: str | None
    start_ms: int
    end_ms: int
    text: str


@dataclass
class ChapterDraft:
    title: str
    description: str
    start_ms: int
    end_ms: int


@dataclass
class ActionItemDraft:
    text: str
    assignee: str | None  # speaker / participant name
    line_index: int | None


@dataclass
class SummaryDraft:
    overview: str
    keywords: list[str]
    notes: list[dict]  # [{"heading", "start_ms", "bullets"}]
    chapters: list[ChapterDraft]
    action_items: list[ActionItemDraft]
    engine: str = "heuristic"


@dataclass
class AnswerDraft:
    answer: str
    line_indexes: list[int] = field(default_factory=list)
    engine: str = "heuristic"


@dataclass(frozen=True)
class MeetingContext:
    title: str
    participants: list[str]
    lines: list[Line]
    overview: str | None = None
    action_items: list[str] = field(default_factory=list)


class Summarizer(Protocol):
    def summarize(self, ctx: MeetingContext) -> SummaryDraft: ...


class Assistant(Protocol):
    def answer(self, ctx: MeetingContext, question: str, history: list[tuple[str, str]]) -> AnswerDraft: ...
