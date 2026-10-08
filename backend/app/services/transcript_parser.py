"""Parse uploaded/pasted transcripts into timed, speaker-labelled segments.

Supported inputs:
  * WebVTT  (``WEBVTT`` header; ``<v Name>`` voice tags or ``Name: text`` cues)
  * SRT     (numbered cues with ``00:00:01,000 --> 00:00:04,000``)
  * JSON    (a list, or ``{"segments"|"transcript"|"sentences": [...]}``, of objects
             with speaker/start/end/text-ish keys; seconds, ms or "hh:mm:ss")
  * Plain text, line oriented, e.g.
        [00:01:23] Sarah: text          00:01:23 Sarah: text
        Sarah (01:23): text              Sarah: text
        Sarah  01:23   <- speaker header line, text on following lines

Lines without timestamps get times estimated from word count (~150 wpm).
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass

WORDS_PER_SECOND = 2.5
MIN_SEGMENT_MS = 1500


class TranscriptParseError(ValueError):
    pass


@dataclass
class ParsedSegment:
    speaker: str | None
    text: str
    start_ms: int | None = None
    end_ms: int | None = None


# --- timestamp helpers ------------------------------------------------------

_TS = r"(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?"


def parse_timestamp(value: str) -> int:
    """'01:02:03.5' | '2:03' | '00:00:01,250' -> milliseconds."""
    value = value.strip().replace(",", ".")
    parts = value.split(":")
    if not 1 <= len(parts) <= 3:
        raise TranscriptParseError(f"Bad timestamp: {value!r}")
    seconds = 0.0
    for part in parts:
        seconds = seconds * 60 + float(part)
    return int(round(seconds * 1000))


def _estimate_ms(text: str) -> int:
    words = len(text.split())
    return max(MIN_SEGMENT_MS, int(words / WORDS_PER_SECOND * 1000))


def _finalize(segments: list[ParsedSegment]) -> list[ParsedSegment]:
    """Fill in missing start/end times and drop empty segments."""
    segments = [s for s in segments if s.text.strip()]
    if not segments:
        raise TranscriptParseError("No transcript lines found.")

    cursor = 0
    for i, seg in enumerate(segments):
        seg.text = re.sub(r"\s+", " ", seg.text).strip()
        if seg.start_ms is None:
            seg.start_ms = cursor
        seg.start_ms = max(seg.start_ms, 0)
        if seg.end_ms is None:
            nxt = next((s.start_ms for s in segments[i + 1:] if s.start_ms is not None), None)
            estimated = seg.start_ms + _estimate_ms(seg.text)
            seg.end_ms = min(estimated, nxt) if nxt is not None and nxt > seg.start_ms else estimated
        seg.end_ms = max(seg.end_ms, seg.start_ms)
        cursor = seg.end_ms + 300
    return segments


# --- format detection -------------------------------------------------------

def detect_format(content: str, filename: str | None = None) -> str:
    if filename:
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if ext in {"vtt", "srt", "json", "txt"}:
            return ext
    head = content.lstrip()[:200]
    if head.startswith("WEBVTT"):
        return "vtt"
    if head[:1] in "[{":
        try:
            json.loads(content)
            return "json"
        except ValueError:
            pass  # e.g. "[00:01] Name: text" – plain text with bracketed timestamps
    if re.match(r"^\d+\s*\r?\n\s*\d{2}:\d{2}:\d{2},\d{3}\s*-->", head):
        return "srt"
    return "txt"


def parse_transcript(content: str, fmt: str = "auto", filename: str | None = None) -> list[ParsedSegment]:
    content = content.replace("﻿", "").replace("\r\n", "\n").strip()
    if not content:
        raise TranscriptParseError("Transcript is empty.")
    if fmt == "auto":
        fmt = detect_format(content, filename)
    parser = {"vtt": _parse_cues, "srt": _parse_cues, "json": _parse_json, "txt": _parse_text}.get(fmt)
    if parser is None:
        raise TranscriptParseError(f"Unsupported format: {fmt}")
    return _finalize(parser(content))


# --- parsers ----------------------------------------------------------------

_CUE_TIME = re.compile(rf"^\s*({_TS})\s*-->\s*({_TS})")
_VOICE = re.compile(r"<v(?:\.[^\s>]+)?\s+([^>]+)>")
_SPEAKER_PREFIX = re.compile(r"^([A-Z][\w.'\- ]{0,40}?):\s+(.+)$")


def _split_speaker(text: str) -> tuple[str | None, str]:
    voice = _VOICE.search(text)
    if voice:
        return voice.group(1).strip(), re.sub(r"</?v[^>]*>", "", text).strip()
    m = _SPEAKER_PREFIX.match(text)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return None, text


def _parse_cues(content: str) -> list[ParsedSegment]:
    """WebVTT and SRT share the same cue structure: a time line followed by text lines."""
    segments: list[ParsedSegment] = []
    for block in re.split(r"\n\s*\n", content):
        lines = [ln for ln in block.split("\n") if ln.strip()]
        time_idx = next((i for i, ln in enumerate(lines) if _CUE_TIME.match(ln)), None)
        if time_idx is None:
            continue  # header, NOTE or STYLE block
        m = _CUE_TIME.match(lines[time_idx])
        raw = " ".join(lines[time_idx + 1:])
        speaker, text = _split_speaker(re.sub(r"<(?!v[\s.])[^>]+>", "", raw))
        seg = ParsedSegment(speaker, text, parse_timestamp(m.group(1)), parse_timestamp(m.group(2)))
        prev = segments[-1] if segments else None
        # Captions often split one utterance into many short cues: merge same-speaker runs.
        if prev and speaker == prev.speaker and seg.start_ms - (prev.end_ms or 0) < 1000 and len(prev.text) < 300:
            prev.text = f"{prev.text} {text}"
            prev.end_ms = seg.end_ms
        else:
            segments.append(seg)
    return segments


def _time_value(value, unit_ms: bool) -> int | None:
    if value is None or value == "":
        return None
    if isinstance(value, str):
        if ":" in value:
            return parse_timestamp(value)
        value = float(value)
    return int(value if unit_ms else float(value) * 1000)


def _parse_json(content: str) -> list[ParsedSegment]:
    try:
        data = json.loads(content)
    except ValueError as exc:
        raise TranscriptParseError(f"Invalid JSON: {exc}") from exc
    if isinstance(data, dict):
        data = next((data[k] for k in ("segments", "transcript", "sentences", "utterances") if k in data), None)
    if not isinstance(data, list):
        raise TranscriptParseError("JSON must be a list of segments or contain a 'segments' list.")

    segments = []
    for item in data:
        if not isinstance(item, dict):
            continue
        text = item.get("text") or item.get("sentence") or item.get("content") or ""
        speaker = item.get("speaker") or item.get("speaker_name") or item.get("name")
        if isinstance(speaker, dict):
            speaker = speaker.get("name")
        unit_ms = any(k in item for k in ("start_ms", "startMs", "start_time_ms"))
        start = next((item[k] for k in ("start_ms", "startMs", "start", "start_time", "startTime") if k in item), None)
        end = next((item[k] for k in ("end_ms", "endMs", "end", "end_time", "endTime") if k in item), None)
        segments.append(ParsedSegment(
            str(speaker).strip() if speaker else None, str(text),
            _time_value(start, unit_ms), _time_value(end, unit_ms),
        ))
    return segments


_TXT_PATTERNS = [
    # [00:01:23] Sarah: text   |   00:01:23 Sarah: text   |   (01:23) Sarah: text
    re.compile(rf"^[\[(]?(?P<ts>{_TS})[\])]?\s*[-–]?\s*(?P<speaker>[^:\[\]]{{1,40}}):\s*(?P<text>.+)$"),
    # Sarah [00:01:23]: text   |   Sarah (01:23): text
    re.compile(rf"^(?P<speaker>[^:\[\]()]{{1,40}}?)\s*[\[(](?P<ts>{_TS})[\])]\s*:?\s*(?P<text>.+)$"),
    # Sarah: text
    re.compile(r"^(?P<speaker>[A-Z][\w.'\- ]{0,40}?):\s+(?P<text>.+)$"),
]
# A line that is only a speaker name and timestamp, with the text on following lines.
_TXT_HEADER = re.compile(rf"^(?P<speaker>[A-Z][\w.'\- ]{{0,40}}?)\s+[\[(]?(?P<ts>{_TS})[\])]?\s*$")


def _parse_text(content: str) -> list[ParsedSegment]:
    segments: list[ParsedSegment] = []
    for raw in content.split("\n"):
        line = raw.strip()
        if not line:
            continue
        header = _TXT_HEADER.match(line)
        if header:
            segments.append(ParsedSegment(header["speaker"].strip(), "", parse_timestamp(header["ts"])))
            continue
        for pattern in _TXT_PATTERNS:
            m = pattern.match(line)
            if m:
                ts = m.groupdict().get("ts")
                segments.append(ParsedSegment(
                    m["speaker"].strip(), m["text"], parse_timestamp(ts) if ts else None
                ))
                break
        else:
            if segments:  # continuation of the previous utterance
                segments[-1].text = f"{segments[-1].text} {line}".strip()
            else:
                segments.append(ParsedSegment(None, line))
    return segments
