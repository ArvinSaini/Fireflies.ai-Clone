"""Render a meeting (summary + action items + transcript) as Markdown, plain text or JSON."""
from __future__ import annotations

import json

from app.models import Meeting, TranscriptSegment
from app.services.ai.heuristic import fmt_ms


def _header(meeting: Meeting) -> list[str]:
    return [
        f"Date: {meeting.started_at:%A, %B %d, %Y at %I:%M %p}",
        f"Duration: {fmt_ms(meeting.duration_ms)}",
        f"Participants: {', '.join(p.name for p in meeting.participants) or '—'}",
    ]


def to_markdown(meeting: Meeting, segments: list[TranscriptSegment]) -> str:
    out = [f"# {meeting.title}", ""] + [f"- {line}" for line in _header(meeting)] + [""]
    s = meeting.summary
    if s:
        if s.keywords:
            out += ["**Keywords:** " + ", ".join(s.keywords), ""]
        out += ["## Overview", "", s.overview, ""]
        if s.notes:
            out += ["## Notes", ""]
            for note in s.notes:
                out.append(f"### {note['heading']}" + (f" ({fmt_ms(note['start_ms'])})" if note.get("start_ms") is not None else ""))
                out += [f"- {b}" for b in note["bullets"]] + [""]
    if meeting.action_items:
        out += ["## Action Items", ""]
        for a in meeting.action_items:
            who = f" — **{a.assignee.name}**" if a.assignee else ""
            out.append(f"- [{'x' if a.is_completed else ' '}] {a.text}{who}")
        out.append("")
    if meeting.chapters:
        out += ["## Outline", ""] + [f"- `{fmt_ms(c.start_ms)}` **{c.title}** — {c.description}" for c in meeting.chapters] + [""]
    out += ["## Transcript", ""]
    for seg in segments:
        out += [f"**{seg.speaker.name if seg.speaker else 'Unknown'}** `{fmt_ms(seg.start_ms)}`  ", seg.text, ""]
    return "\n".join(out)


def to_text(meeting: Meeting, segments: list[TranscriptSegment]) -> str:
    out = [meeting.title, "=" * len(meeting.title)] + _header(meeting) + [""]
    s = meeting.summary
    if s:
        out += ["OVERVIEW", s.overview, ""]
    if meeting.action_items:
        out.append("ACTION ITEMS")
        out += [f"[{'x' if a.is_completed else ' '}] {a.text}" + (f" ({a.assignee.name})" if a.assignee else "") for a in meeting.action_items]
        out.append("")
    out.append("TRANSCRIPT")
    out += [f"[{fmt_ms(seg.start_ms)}] {seg.speaker.name if seg.speaker else 'Unknown'}: {seg.text}" for seg in segments]
    return "\n".join(out)


def to_json(meeting: Meeting, segments: list[TranscriptSegment]) -> str:
    s = meeting.summary
    return json.dumps({
        "title": meeting.title,
        "started_at": meeting.started_at.isoformat(),
        "duration_ms": meeting.duration_ms,
        "participants": [{"name": p.name, "email": p.email} for p in meeting.participants],
        "summary": {"overview": s.overview, "keywords": s.keywords, "notes": s.notes} if s else None,
        "action_items": [{"text": a.text, "completed": a.is_completed, "assignee": a.assignee.name if a.assignee else None}
                         for a in meeting.action_items],
        "chapters": [{"title": c.title, "start_ms": c.start_ms, "end_ms": c.end_ms} for c in meeting.chapters],
        "segments": [{"speaker": seg.speaker.name if seg.speaker else None, "start_ms": seg.start_ms,
                      "end_ms": seg.end_ms, "text": seg.text} for seg in segments],
    }, indent=2, ensure_ascii=False)


EXPORTERS = {
    "md": (to_markdown, "text/markdown"),
    "txt": (to_text, "text/plain"),
    "json": (to_json, "application/json"),
}
