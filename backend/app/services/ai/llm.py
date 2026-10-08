"""Claude-backed summarizer and Q&A, used when ANTHROPIC_API_KEY is configured.

Both use structured outputs (`client.messages.parse` with a Pydantic schema), so the
response is validated JSON rather than free text we would have to scrape.
"""
from __future__ import annotations

import anthropic
from pydantic import BaseModel, Field

from app.services.ai.heuristic import fmt_ms
from app.services.ai.types import (
    ActionItemDraft,
    AnswerDraft,
    ChapterDraft,
    Line,
    MeetingContext,
    SummaryDraft,
)


class LLMRefusal(RuntimeError):
    pass


# --- output schemas -----------------------------------------------------------

class _Note(BaseModel):
    heading: str = Field(description="Short topic heading starting with one fitting emoji")
    start_line: int = Field(description="Line number where this topic starts")
    bullets: list[str] = Field(description="2-4 concise bullet points")


class _Chapter(BaseModel):
    title: str
    description: str = Field(description="One sentence")
    start_line: int


class _Action(BaseModel):
    text: str = Field(description="Imperative task, e.g. 'Send the revised deck to Acme'")
    assignee: str | None = Field(description="Participant name responsible, or null")
    line: int = Field(description="Line number where the task was mentioned")


class _Summary(BaseModel):
    overview: str = Field(description="3-5 sentence paragraph")
    keywords: list[str] = Field(description="6-10 short keyword phrases")
    notes: list[_Note]
    chapters: list[_Chapter]
    action_items: list[_Action]


class _Answer(BaseModel):
    answer: str = Field(description="Helpful, concise answer grounded in the transcript")
    cited_lines: list[int] = Field(description="Line numbers supporting the answer (max 4)")


# --- helpers ------------------------------------------------------------------

def _render_transcript(lines: list[Line]) -> str:
    return "\n".join(f"L{ln.index} [{fmt_ms(ln.start_ms)}] {ln.speaker or 'Unknown'}: {ln.text}" for ln in lines)


def _line_at(lines: list[Line], index: int) -> Line:
    return lines[max(0, min(index, len(lines) - 1))]


class _ClaudeBase:
    def __init__(self, api_key: str, model: str):
        self.client = anthropic.Anthropic(api_key=api_key, max_retries=1, timeout=90)
        self.model = model

    def _parse(self, system: str, prompt: str, schema: type[BaseModel]) -> BaseModel:
        response = self.client.messages.parse(
            model=self.model,
            max_tokens=16000,
            system=system,
            messages=[{"role": "user", "content": prompt}],
            output_config={"effort": "low"},
            output_format=schema,
        )
        if response.stop_reason == "refusal" or response.parsed_output is None:
            raise LLMRefusal(f"LLM returned no usable output (stop_reason={response.stop_reason})")
        return response.parsed_output


class ClaudeSummarizer(_ClaudeBase):
    SYSTEM = (
        "You are Fred, a meeting assistant like Fireflies.ai. You write accurate, skimmable meeting "
        "summaries grounded strictly in the transcript. Never invent facts. Transcript lines are "
        "prefixed with L<number>; refer to lines by that number."
    )

    def summarize(self, ctx: MeetingContext) -> SummaryDraft:
        lines = ctx.lines
        prompt = (
            f"Meeting title: {ctx.title}\nParticipants: {', '.join(ctx.participants) or 'unknown'}\n\n"
            f"<transcript>\n{_render_transcript(lines)}\n</transcript>\n\n"
            "Produce: an overview paragraph; keywords; 3-5 notes sections in chronological order; "
            "3-6 chapters covering the whole meeting in order; and every concrete action item."
        )
        out: _Summary = self._parse(self.SYSTEM, prompt, _Summary)  # type: ignore[assignment]

        chapters = []
        starts = sorted({max(0, c.start_line) for c in out.chapters})
        for c in sorted(out.chapters, key=lambda c: c.start_line):
            start = _line_at(lines, c.start_line)
            later = [s for s in starts if s > c.start_line]
            end = _line_at(lines, later[0] - 1) if later else lines[-1]
            chapters.append(ChapterDraft(c.title, c.description, start.start_ms, end.end_ms))

        return SummaryDraft(
            overview=out.overview,
            keywords=out.keywords[:10],
            notes=[{"heading": n.heading, "start_ms": _line_at(lines, n.start_line).start_ms, "bullets": n.bullets}
                   for n in out.notes],
            chapters=chapters,
            action_items=[ActionItemDraft(a.text, a.assignee, _line_at(lines, a.line).index) for a in out.action_items],
            engine="llm",
        )


class ClaudeAssistant(_ClaudeBase):
    SYSTEM = (
        "You are Fred, the AskFred assistant inside a Fireflies-style meeting app. Answer questions "
        "about ONE meeting using only its transcript and summary. If the transcript doesn't contain the "
        "answer, say so. Keep answers short; use '• ' bullets for lists. Cite supporting line numbers."
    )

    def answer(self, ctx: MeetingContext, question: str, history: list[tuple[str, str]]) -> AnswerDraft:
        past = "\n".join(f"{role.upper()}: {text}" for role, text in history[-6:])
        prompt = (
            f"Meeting: {ctx.title}\nSummary: {ctx.overview or 'n/a'}\n\n"
            f"<transcript>\n{_render_transcript(ctx.lines)}\n</transcript>\n\n"
            + (f"<conversation_so_far>\n{past}\n</conversation_so_far>\n\n" if past else "")
            + f"Question: {question}"
        )
        out: _Answer = self._parse(self.SYSTEM, prompt, _Answer)  # type: ignore[assignment]
        valid = [i for i in out.cited_lines if 0 <= i < len(ctx.lines)][:4]
        return AnswerDraft(out.answer, valid, engine="llm")
