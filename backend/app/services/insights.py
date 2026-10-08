"""Per-meeting analytics for the Smart Search panel, computed from transcript segments:
speaker talk time, "AI filters" (questions, dates & times, metrics, tasks), sentiment
and topic-tracker mentions. Everything is rule-based so it is instant and explainable."""
from __future__ import annotations

import re
from collections import defaultdict

from app.models import TopicTracker, TranscriptSegment
from app.schemas.common import ParticipantOut
from app.schemas.meeting import MeetingAnalytics, SpeakerStat, TopicHit

FILTER_PATTERNS: dict[str, re.Pattern] = {
    "questions": re.compile(r"\?"),
    "dates": re.compile(
        r"\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|tonight|yesterday|next week|"
        r"this week|end of (?:the )?(?:day|week|month|quarter)|january|february|march|april|may|june|july|"
        r"august|september|october|november|december|q[1-4]|\d{1,2}(?::\d{2})?\s?(?:am|pm)|eod|eow)\b",
        re.I,
    ),
    # Quantities: "$40k", "18%", "250 seats" and spelled-out ones ("eighteen percent", "forty thousand").
    "metrics": re.compile(
        r"(\$\s?\d[\d,.]*\s?[kmb]?|\b\d+(?:\.\d+)?\s?(?:%|percent|k\b|million|billion|x\b|ms\b|users|customers|seats|deals)"
        r"|\b(?:\w+[- ])?(?:hundred|thousand|million|billion|percent)\b"
        r"|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|thirty|forty|fifty|sixty|seventy|"
        r"eighty|ninety)[- ]?(?:\w+[- ])?(?:seats|users|customers|accounts|deals|tickets|licenses|k)\b)",
        re.I,
    ),
    "tasks": re.compile(
        r"\b(i'll|i will|i'm going to|can you|could you|we need to|we should|action item|follow up|let me|by (?:monday|tuesday|wednesday|thursday|friday|eod|end of))\b",
        re.I,
    ),
}


POSITIVE = frozenset("""
great good awesome excellent love like happy glad excited amazing perfect fantastic nice impressive solid strong
win wins won agree agreed thanks thank helpful easy smooth success successful improve improved improvement
appreciate love clear exactly absolutely definitely confident promising better best progress resolved
""".split())
NEGATIVE = frozenset("""
bad issue issues problem problems concern concerns concerned worried worry risk risks blocker blocked blocking
delay delayed slow difficult hard confusing confused frustrated frustrating unfortunately fail failed failing
bug bugs broken churn lost lose losing expensive worse worst missing late hate annoying pain painful struggle
""".split())
_WORD = re.compile(r"[a-z']+")


def sentiment(text: str) -> str:
    """Lexicon score with simple negation handling ("not good" counts as negative)."""
    score, prev = 0, ""
    for word in _WORD.findall(text.lower()):
        sign = -1 if prev in {"not", "no", "never", "don't", "isn't", "wasn't", "aren't"} else 1
        if word in POSITIVE:
            score += sign
        elif word in NEGATIVE:
            score -= sign
        prev = word
    return "positive" if score > 0 else "negative" if score < 0 else "neutral"


def classify(text: str) -> list[str]:
    return [name for name, pattern in FILTER_PATTERNS.items() if pattern.search(text)]


def _tracker_pattern(keywords: list[str]) -> re.Pattern | None:
    words = [re.escape(k.strip()) for k in keywords if k.strip()]
    return re.compile(r"\b(" + "|".join(words) + r")\w*", re.I) if words else None


def meeting_analytics(segments: list[TranscriptSegment], trackers: list[TopicTracker] = ()) -> MeetingAnalytics:
    talk: dict[int | None, dict] = defaultdict(lambda: {"ms": 0, "segments": 0, "words": 0, "speaker": None})
    filters: dict[str, list[int]] = {name: [] for name in FILTER_PATTERNS}
    sentiments: dict[str, list[int]] = {"positive": [], "neutral": [], "negative": []}
    patterns = [(t, _tracker_pattern(t.keywords)) for t in trackers]
    topic_hits: dict[int, tuple[int, list[int]]] = {t.id: (0, []) for t in trackers}
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
        sentiments[sentiment(seg.text)].append(seg.id)
        for tracker, pattern in patterns:
            if pattern and (mentions := len(pattern.findall(seg.text))):
                count, ids = topic_hits[tracker.id]
                topic_hits[tracker.id] = (count + mentions, ids + [seg.id])

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
    topics = [
        TopicHit(tracker_id=t.id, name=t.name, color=t.color, count=topic_hits[t.id][0], segment_ids=topic_hits[t.id][1])
        for t in trackers
    ]
    return MeetingAnalytics(
        speakers=speakers, filters=filters, sentiments=sentiments, topics=topics,
        total_words=total_words, question_count=len(filters["questions"]),
    )
