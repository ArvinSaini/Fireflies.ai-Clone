"""Tiny NLP helpers for the heuristic engine (no external dependencies)."""
from __future__ import annotations

import re
from collections import Counter

STOPWORDS = frozenset("""
a about above after again against all also am an and any are aren't as at be because been before being below
between both but by can can't cannot could couldn't did didn't do does doesn't doing don't down during each few
for from further get got gonna had hadn't has hasn't have haven't having he he'd he'll he's her here here's hers
herself him himself his how how's i i'd i'll i'm i've if in into is isn't it it's its itself just let let's like
me more most mustn't my myself no nor not now of off on once only or other ought our ours ourselves out over own
really right same say said shan't she she'd she'll she's should shouldn't so some such sure than that that's the
their theirs them themselves then there there's these they they'd they'll they're they've thing things think
this those through to too under until up us very was wasn't we we'd we'll we're we've were weren't what what's
when when's where where's which while who who's whom why why's will with won't would wouldn't yeah yes you you'd
you'll you're you've your yours yourself yourselves okay ok um uh hmm oh well kind sort lot lots actually maybe
going go know mean want need yep great good thanks thank cool awesome guys everyone one two also basically pretty
quite probably definitely totally exactly anyway alright bit way look looks see make sounds sound even still
much many back today tomorrow week next last time take come day put something anything everything someone done
monday tuesday wednesday thursday friday saturday sunday january february march april june july august
september october november december meeting call folks minutes morning afternoon evening quick
""".split())

_WORD = re.compile(r"[a-zA-Z][a-zA-Z'\-]+")
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'])")


def words(text: str) -> list[str]:
    return [w.lower().strip("'-") for w in _WORD.findall(text)]


def content_words(text: str) -> list[str]:
    return [w for w in words(text) if w not in STOPWORDS and len(w) > 2]


def sentences(text: str) -> list[str]:
    return [s.strip() for s in _SENTENCE_SPLIT.split(text) if s.strip()]


def stem(word: str) -> str:
    """Crude suffix stripper; good enough to match 'pricing' with 'price'."""
    for suffix in ("ing", "ers", "ies", "ied", "ed", "es", "er", "ly", "s"):
        if word.endswith(suffix) and len(word) - len(suffix) >= 3:
            return word[: -len(suffix)]
    return word


def phrase_counts(texts: list[str]) -> Counter[str]:
    """Count unigrams and bigrams of content words. Bigrams only count when both words
    are adjacent content words in the original text."""
    counts: Counter[str] = Counter()
    for text in texts:
        toks = words(text)
        for i, tok in enumerate(toks):
            if tok in STOPWORDS or len(tok) <= 2:
                continue
            counts[tok] += 1
            if i + 1 < len(toks):
                nxt = toks[i + 1]
                if nxt not in STOPWORDS and len(nxt) > 2:
                    counts[f"{tok} {nxt}"] += 1
    return counts


def top_keywords(texts: list[str], limit: int = 8) -> list[str]:
    counts = phrase_counts(texts)
    scored: list[tuple[float, str]] = []
    for phrase, n in counts.items():
        if n < 2:  # a phrase mentioned once is rarely a topic
            continue
        scored.append((n * (2.2 if " " in phrase else 1.0), phrase))
    scored.sort(reverse=True)

    chosen: list[str] = []
    for _, phrase in scored:
        # Skip unigrams already covered by a chosen bigram (and vice-versa).
        if any(phrase in c.split() or c in phrase.split() for c in chosen):
            continue
        chosen.append(phrase)
        if len(chosen) == limit:
            break
    return [titlecase(c) for c in chosen]


def titlecase(phrase: str) -> str:
    small = {"and", "or", "of", "the", "a", "to", "in", "on", "for"}
    out = []
    for i, w in enumerate(phrase.split()):
        if (w.isupper() and len(w) > 1) or (i and w in small):  # keep acronyms and small words as-is
            out.append(w)
        else:
            out.append(w[:1].upper() + w[1:])
    return " ".join(out)


def truncate_words(text: str, limit: int) -> str:
    toks = text.split()
    if len(toks) <= limit:
        return text
    return " ".join(toks[:limit]).rstrip(",;:") + "…"
