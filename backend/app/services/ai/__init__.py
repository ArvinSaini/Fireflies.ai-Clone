"""AI engine selection.

`get_summarizer()` / `get_assistant()` return the Claude implementation when an API key
is configured, wrapped so that any LLM failure transparently falls back to the
heuristic engine. Callers never need to know which engine ran (it is recorded in
`SummaryDraft.engine` / `AnswerDraft.engine`).
"""
from __future__ import annotations

import logging

from app.core.config import get_settings
from app.services.ai.heuristic import HeuristicAssistant, HeuristicSummarizer
from app.services.ai.types import AnswerDraft, Assistant, Line, MeetingContext, Summarizer, SummaryDraft

log = logging.getLogger(__name__)

__all__ = ["Line", "MeetingContext", "get_assistant", "get_summarizer"]


class _WithFallback:
    def __init__(self, primary, fallback):
        self.primary, self.fallback = primary, fallback

    def summarize(self, ctx: MeetingContext) -> SummaryDraft:
        try:
            return self.primary.summarize(ctx)
        except Exception:  # noqa: BLE001 - any LLM failure degrades gracefully
            log.exception("LLM summarization failed; using heuristic engine")
            return self.fallback.summarize(ctx)

    def answer(self, ctx: MeetingContext, question: str, history: list[tuple[str, str]]) -> AnswerDraft:
        try:
            return self.primary.answer(ctx, question, history)
        except Exception:  # noqa: BLE001
            log.exception("LLM answer failed; using heuristic engine")
            return self.fallback.answer(ctx, question, history)


def get_summarizer() -> Summarizer:
    settings = get_settings()
    if settings.llm_enabled:
        from app.services.ai.llm import ClaudeSummarizer

        return _WithFallback(ClaudeSummarizer(settings.anthropic_api_key, settings.llm_model), HeuristicSummarizer())
    return HeuristicSummarizer()


def get_assistant() -> Assistant:
    settings = get_settings()
    if settings.llm_enabled:
        from app.services.ai.llm import ClaudeAssistant

        return _WithFallback(ClaudeAssistant(settings.anthropic_api_key, settings.llm_model), HeuristicAssistant())
    return HeuristicAssistant()
