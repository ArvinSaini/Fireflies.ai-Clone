"""Dependency-free summarizer and Q&A engine.

It is extractive: it picks and lightly trims real transcript sentences instead of
writing new prose. That keeps it deterministic, fast and always grounded in the
transcript, and the app stays fully functional without an LLM key.
"""
from __future__ import annotations

import math
import re
from collections import Counter

from app.services.ai.text_utils import (
    content_words, phrase_counts, sentences, stem, titlecase, top_keywords, truncate_words,
)
from app.services.ai.types import (
    ActionItemDraft, AnswerDraft, ChapterDraft, Line, MeetingContext, SummaryDraft,
)

ACTION_VERBS = frozenset("""
send share schedule set follow update review draft write prepare create book reach look check fix ship finalize
put get talk sync file add run test investigate loop circle email call build design publish deploy document
compile confirm sort move organize coordinate own handle start kick pull push merge spec scope plan research
reply ping post submit order hire interview onboard align present demo audit migrate refactor clean outline
""".split())

_SELF_COMMIT = re.compile(r"\b(?:I'll|I will|I'm going to|I am going to|I can|let me|I'll go ahead and)\s+(?P<task>.+)", re.I)
_ASK_NAMED = re.compile(r"\b(?P<name>[A-Z][a-z]+),?\s+(?:can|could|would|will) you\s+(?P<task>.+)")
_ASK = re.compile(r"\b(?:can|could|would) you\s+(?P<task>.+)", re.I)
_TEAM = re.compile(r"\b(?:we need to|we should|we have to|we'll need to|action item(?: is)?[:,]?|next step is to)\s+(?P<task>.+)", re.I)

_FILLER_START = re.compile(r"^(?:yeah|yep|okay|ok|um+|uh+|so|right|sure|cool|great|alright|and|but)\b[,.]?\s*", re.I)

NOTE_EMOJI = [
    (("roadmap", "launch", "release", "ship", "feature", "milestone"), "🚀"),
    (("budget", "pricing", "price", "revenue", "cost", "deal", "pipeline", "quota", "arr"), "💰"),
    (("design", "onboarding", "flow", "mockup", "prototype", "ux", "ui"), "🎨"),
    (("bug", "api", "deploy", "infra", "engineering", "performance", "latency", "migration", "code"), "🛠️"),
    (("customer", "client", "feedback", "user", "users", "support"), "🤝"),
    (("hiring", "candidate", "interview", "recruit", "offer", "role"), "👥"),
    (("marketing", "campaign", "brand", "content", "social", "webinar", "seo"), "📣"),
    (("timeline", "deadline", "date", "schedule", "quarter", "sprint"), "📅"),
    (("metric", "metrics", "data", "dashboard", "analytics", "conversion", "churn", "growth"), "📊"),
    (("risk", "blocker", "issue", "concern", "problem"), "⚠️"),
]


def fmt_ms(ms: int) -> str:
    s = ms // 1000
    h, rem = divmod(s, 3600)
    m, sec = divmod(rem, 60)
    return f"{h}:{m:02d}:{sec:02d}" if h else f"{m:02d}:{sec:02d}"


def _clean(sentence: str) -> str:
    out = sentence
    for _ in range(3):  # strip stacked fillers: "Yeah, so, okay ..."
        out = _FILLER_START.sub("", out)
    out = out.strip(" ,")
    return out[:1].upper() + out[1:] if out else out


def _first_name(name: str | None) -> str | None:
    return name.split()[0] if name else None


class _Scorer:
    """Scores sentences by how much of the meeting's vocabulary they carry."""

    def __init__(self, lines: list[Line]):
        self.weights = Counter(w for ln in lines for w in content_words(ln.text))

    def sentence(self, text: str) -> float:
        toks = content_words(text)
        n_words = len(text.split())
        if n_words < 6 or text.endswith("?"):
            return 0.0
        return sum(math.log1p(self.weights[t]) for t in set(toks)) / math.sqrt(n_words)

    def best_sentences(self, lines: list[Line], limit: int) -> list[tuple[Line, str]]:
        candidates = [(self.sentence(s), ln.index, ln, s) for ln in lines for s in sentences(ln.text)]
        candidates = [c for c in candidates if c[0] > 0]
        candidates.sort(key=lambda c: -c[0])
        picked = sorted(candidates[:limit], key=lambda c: c[1])
        return [(ln, _clean(s)) for _, _, ln, s in picked]


class HeuristicSummarizer:
    def summarize(self, ctx: MeetingContext) -> SummaryDraft:
        lines = ctx.lines
        if not lines:
            return SummaryDraft("No transcript available for this meeting yet.", [], [], [], [])

        scorer = _Scorer(lines)
        keywords = top_keywords([ln.text for ln in lines], limit=8)
        chapters = self._chapters(lines, scorer)
        notes = self._notes(lines, chapters, scorer)
        actions = extract_action_items(lines, ctx.participants)
        overview = self._overview(ctx, keywords, scorer, len(actions))
        return SummaryDraft(overview, keywords, notes, chapters, actions, engine="heuristic")

    # -- pieces --------------------------------------------------------------

    def _overview(self, ctx: MeetingContext, keywords: list[str], scorer: _Scorer, n_actions: int) -> str:
        people = [_first_name(p) for p in ctx.participants if p][:4]
        who = ", ".join(people[:-1]) + f" and {people[-1]}" if len(people) > 1 else (people[0] if people else "The team")
        topics = [k.lower() for k in keywords[:3]]
        topic_str = ", ".join(topics[:-1]) + f" and {topics[-1]}" if len(topics) > 1 else (topics[0] if topics else "several topics")
        parts = [f"{who} met to discuss {topic_str}."]
        for _, sent in scorer.best_sentences(ctx.lines, 3):
            parts.append(truncate_words(sent.rstrip(".") + ".", 30))
        if n_actions:
            parts.append(f"The meeting closed with {n_actions} follow-up action item{'s' if n_actions != 1 else ''}.")
        return " ".join(parts)

    def _chapters(self, lines: list[Line], scorer: _Scorer) -> list[ChapterDraft]:
        total_ms = lines[-1].end_ms
        k = max(1, min(6, round(total_ms / 360_000)))  # ~one chapter per 6 minutes
        k = min(k, max(1, len(lines) // 4))
        groups = _split_by_time(lines, k)

        all_counts = phrase_counts([ln.text for ln in lines])
        used: set[str] = set()
        chapters = []
        for i, group in enumerate(groups):
            local = phrase_counts([ln.text for ln in group])
            # Distinctiveness: frequent here, relatively rare elsewhere.
            ranked = sorted(
                (
                    (n * (1.8 if " " in p else 1.0) * (n / all_counts[p]), p)
                    for p, n in local.items() if n >= 2 and p not in used
                ),
                reverse=True,
            )
            title = titlecase(ranked[0][1]) if ranked else ("Introductions" if i == 0 else f"Discussion {i + 1}")
            used.add(title.lower())
            best = scorer.best_sentences(group, 1)
            description = truncate_words(best[0][1], 24) if best else ""
            chapters.append(ChapterDraft(title, description, group[0].start_ms, group[-1].end_ms))
        return chapters

    def _notes(self, lines: list[Line], chapters: list[ChapterDraft], scorer: _Scorer) -> list[dict]:
        notes = []
        for ch in chapters:
            group = [ln for ln in lines if ch.start_ms <= ln.start_ms <= ch.end_ms]
            bullets = [truncate_words(s, 22) for _, s in scorer.best_sentences(group, 3)]
            if bullets:
                notes.append({"heading": f"{_emoji_for(ch.title)} {ch.title}", "start_ms": ch.start_ms, "bullets": bullets})
        return notes


def _emoji_for(title: str) -> str:
    toks = {stem(w) for w in content_words(title)} | set(content_words(title))
    for keys, emoji in NOTE_EMOJI:
        if toks & set(keys):
            return emoji
    return "📌"


def _split_by_time(lines: list[Line], k: int) -> list[list[Line]]:
    if k <= 1:
        return [lines]
    total = lines[-1].end_ms or 1
    groups: list[list[Line]] = [[] for _ in range(k)]
    for ln in lines:
        groups[min(k - 1, int(ln.start_ms / total * k))].append(ln)
    return [g for g in groups if g]


def extract_action_items(lines: list[Line], participants: list[str], limit: int = 8) -> list[ActionItemDraft]:
    """Find commitments ("I'll send…", "Marcus, can you…", "we need to…")."""
    by_first = {_first_name(p).lower(): p for p in participants if p}
    found: list[ActionItemDraft] = []
    seen: list[set[str]] = []

    for i, ln in enumerate(lines):
        for sent in sentences(ln.text):
            draft = None
            if m := _ASK_NAMED.search(sent):
                name = by_first.get(m["name"].lower())
                if name:
                    draft = (m["task"], name)
            if draft is None and (m := _SELF_COMMIT.search(sent)):
                draft = (m["task"], ln.speaker)
            if draft is None and (m := _ASK.search(sent)):
                nxt = lines[i + 1].speaker if i + 1 < len(lines) else None
                draft = (m["task"], nxt if nxt != ln.speaker else None)
            if draft is None and (m := _TEAM.search(sent)):
                draft = (m["task"], None)
            if draft is None:
                continue

            task = _normalize_task(draft[0])
            if not task:
                continue
            # Skip near-duplicates ("Can you send X?" followed by "I'll send X").
            key = {stem(w) for w in content_words(task)}
            if any(len(key & other) / max(1, len(key | other)) >= 0.6 for other in seen):
                continue
            seen.append(key)
            found.append(ActionItemDraft(task, draft[1], ln.index))
            if len(found) == limit:
                return found
    return found


def _normalize_task(task: str) -> str | None:
    task = re.split(r"(?<=[.!?])\s", task.strip())[0]
    task = task.strip(" .,!?;:")
    task = re.sub(r"^(?:also|just|quickly|definitely|probably|go ahead and|please)\s+", "", task, flags=re.I)
    first = task.split()[0].lower() if task.split() else ""
    if first not in ACTION_VERBS:
        return None
    task = re.sub(r"\b(?:for me|for us|if that works|if possible)\s*$", "", task, flags=re.I).strip(" ,")
    task = truncate_words(task, 18)
    return task[:1].upper() + task[1:]


# --- Q&A ------------------------------------------------------------------------

class HeuristicAssistant:
    def answer(self, ctx: MeetingContext, question: str, history: list[tuple[str, str]]) -> AnswerDraft:
        q = question.lower()
        lines = ctx.lines
        if not lines:
            return AnswerDraft("This meeting doesn't have a transcript yet, so there's nothing to search.")

        if re.search(r"action item|task|to-?do|next step|follow[- ]?up|assigned", q):
            items = ctx.action_items or [a.text for a in extract_action_items(lines, ctx.participants)]
            if not items:
                return AnswerDraft("I didn't find any action items in this meeting.")
            return AnswerDraft("Here are the action items from this meeting:\n" + "\n".join(f"• {t}" for t in items))

        if re.search(r"summar|recap|overview|tl;?dr|what (?:was|is) (?:this|the meeting) about|what was discussed", q):
            overview = ctx.overview or HeuristicSummarizer().summarize(ctx).overview
            return AnswerDraft(overview)

        if re.search(r"who (?:spoke|talked)|talk(?:ed)? the most|speaker", q):
            talk: Counter[str] = Counter()
            for ln in lines:
                talk[ln.speaker or "Unknown"] += ln.end_ms - ln.start_ms
            total = sum(talk.values()) or 1
            rows = [f"• {name}: {ms * 100 / total:.0f}% ({fmt_ms(ms)})" for name, ms in talk.most_common()]
            return AnswerDraft("Talk time by speaker:\n" + "\n".join(rows))

        if re.search(r"decid|decision|agree|conclu|outcome", q):
            hits = [ln for ln in lines if re.search(r"\b(decid|agree|let's go with|final|approved|sounds like a plan|consensus)", ln.text, re.I)]
            return self._cite("Here are the moments where decisions were made:", hits[:4],
                              "I couldn't find explicit decisions in the transcript.")

        if re.search(r"questions? (?:were|was)? ?asked|what questions", q):
            hits = [ln for ln in lines if "?" in ln.text]
            return self._cite(f"{len(hits)} questions were asked. Some highlights:", hits[:5], "No questions were asked.")

        # Default: keyword retrieval over transcript lines.
        q_terms = {stem(w) for w in content_words(question)}
        if not q_terms:
            return AnswerDraft("Could you rephrase that with a bit more detail?")
        scored = []
        for ln in lines:
            terms = {stem(w) for w in content_words(ln.text)}
            overlap = len(q_terms & terms)
            if overlap:
                # More matched terms first; among equals prefer substantive lines over one-liners.
                substance = min(len(ln.text.split()), 25) / 25
                scored.append((overlap + 0.5 * substance, ln))
        scored.sort(key=lambda s: -s[0])
        best = sorted([ln for _, ln in scored[:3]], key=lambda ln: ln.index)
        topic = " ".join(w for w in question.rstrip("?").split() if w.lower().strip(",.") in set(content_words(question)))
        return self._cite(f"Here's what was said about “{topic or question.rstrip('?')}”:", best,
                          "I couldn't find anything about that in this meeting's transcript.")

    @staticmethod
    def _cite(intro: str, hits: list[Line], empty: str) -> AnswerDraft:
        if not hits:
            return AnswerDraft(empty)
        body = "\n".join(f"• {h.speaker or 'Someone'} ({fmt_ms(h.start_ms)}): “{truncate_words(h.text, 35)}”" for h in hits)
        return AnswerDraft(f"{intro}\n{body}", [h.index for h in hits])
