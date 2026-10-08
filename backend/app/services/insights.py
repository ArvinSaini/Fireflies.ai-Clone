"""Per-meeting analytics: speaker talk time and Fireflies-style "AI filters"
(questions, dates & times, metrics, tasks) computed from transcript segments."""
from __future__ import annotations

import re
from collections import defaultdict

from app.models import TranscriptSegment
from app.schemas.common import ParticipantOut
from app.schemas.meeting import MeetingAnalytics, SpeakerStat

FILTER_PATTERNS: dict[str, re.Pattern] = {
    "questions": re.compile(r"\?"),
    "dates": re.compile(
        r"\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|tonight|yesterday|next week|"
        r"this week|end of (?:the )?(?:day|week|month|quarter)|january|february|march|april|may|june|july|"
        r"august|september|october|november|december|q[1-4]|\d{1,2}(?::\d{2})?\s?(?:am|pm)|eod|eow)\b",
        re.I,
    ),
    "metrics": re.compile(
        r"(\$\s?\d[\d,.]*\s?[kmb]?|\b\d+(?:\.\d+)?\s?(?:%|percent|k\b|million|billion|x\b|ms\b|users|customers|seats|deals))",
        re.I,
    ),
    "tasks": re.compile(
        r"\b(i'll|i will|i'm going to|can you|could you|we need to|we should|action item|follow up|let me|by (?:monday|tuesday|wednesday|thursday|friday|eod|end of))\b",
        re.I,
    ),
}


def classify(text: str) -> list[str]:
    return [name for name, pattern in FILTER_PATTERNS.items() if pattern.search(text)]


def meeting_analytics(segments: list[TranscriptSegment]) -> MeetingAnalytics:
    talk: dict[int | None, dict] = defaultdict(lambda: {"ms": 0, "segments": 0, "words": 0, "speaker": None})
    filters: dict[str, list[int]] = {name: [] for name in FILTER_PATTERNS}
    total_words = 0

    for seg in segments:
        stat = talk[seg.participant_id]
        stat["speaker"] = seg.speaker
        stat["ms"] += max(0, seg.end_ms - seg.start_ms)
        stat["segments"] += 1
        n = len(seg.text.split())
        stat["words"] += n
        total_words += n
        for name in classify(seg.text):
            filters[name].append(seg.id)

    total_ms = sum(s["ms"] for s in talk.values()) or 1
    speakers = [
        SpeakerStat(
            participant=ParticipantOut.model_validate(s["speaker"]) if s["speaker"] else None,
            talk_ms=s["ms"],
            talk_percent=round(s["ms"] * 100 / total_ms, 1),
            segment_count=s["segments"],
            word_count=s["words"],
            words_per_minute=round(s["words"] / (s["ms"] / 60_000)) if s["ms"] else 0,
        )
        for s in sorted(talk.values(), key=lambda s: -s["ms"])
    ]
    return MeetingAnalytics(
        speakers=speakers, filters=filters, total_words=total_words, question_count=len(filters["questions"])
    )
