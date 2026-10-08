"""AI engine selection.

`get_summarizer()` / `get_assistant()` return an LLM implementation (Claude or Gemini, chosen by
`Settings.llm_provider`) wrapped so that any LLM failure transparently falls back to the heuristic
engine; with no API key they return the heuristic engine directly. Callers never need to know which
engine ran (it is recorded in `SummaryDraft.engine` / `AnswerDraft.engine`).
"""
from __future__ import annotations

import logging

from app.core.config import Settings, get_settings
from app.services.ai.heuristic import HeuristicAssistant, HeuristicSummarizer
from app.services.ai.providers import StructuredLLM
from app.services.ai.types import AnswerDraft, Assistant, Line, MeetingContext, Summarizer, SummaryDraft

log = logging.getLogger(__name__)

__all__ = ["Line", "MeetingContext", "build_provider", "engine_name", "get_assistant", "get_summarizer"]


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


def build_provider(settings: Settings) -> StructuredLLM | None:
    """The configured LLM provider, or None when the heuristic engine should be used."""
    from app.services.ai.providers import ClaudeProvider, GeminiProvider

    match settings.llm_provider:
        case "claude":
            return ClaudeProvider(settings.anthropic_api_key, settings.claude_model)
        case "gemini":
            return GeminiProvider(settings.gemini_api_key, settings.gemini_model)
        case _:
            return None


def engine_name(settings: Settings | None = None) -> str:
    """"claude" | "gemini" | "heuristic" — shown in Settings and stored per summary."""
    return (settings or get_settings()).llm_provider or "heuristic"


def get_summarizer() -> Summarizer:
    provider = build_provider(get_settings())
    if provider is None:
        return HeuristicSummarizer()
    from app.services.ai.llm import LLMSummarizer

    return _WithFallback(LLMSummarizer(provider), HeuristicSummarizer())


def get_assistant() -> Assistant:
    provider = build_provider(get_settings())
    if provider is None:
        return HeuristicAssistant()
    from app.services.ai.llm import LLMAssistant

    return _WithFallback(LLMAssistant(provider), HeuristicAssistant())
