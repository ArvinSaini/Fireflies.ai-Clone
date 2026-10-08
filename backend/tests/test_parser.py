import json

import pytest

from app.services.transcript_parser import TranscriptParseError, detect_format, parse_timestamp, parse_transcript


def test_parse_timestamp_formats():
    assert parse_timestamp("00:01:02") == 62_000
    assert parse_timestamp("1:02") == 62_000
    assert parse_timestamp("00:00:01,250") == 1_250
    assert parse_timestamp("01:00:00.5") == 3_600_500


def test_plain_text_with_timestamps():
    segs = parse_transcript("[00:00:05] Alice: Hello there.\n[00:00:09] Bob: Hi Alice!\nThis continues.")
    assert [s.speaker for s in segs] == ["Alice", "Bob"]
    assert segs[0].start_ms == 5_000 and segs[0].end_ms <= 9_000
    assert segs[1].text == "Hi Alice! This continues."


def test_plain_text_without_timestamps_estimates_times():
    segs = parse_transcript("Alice: one two three four five six seven eight nine ten\nBob: ok")
    assert segs[0].start_ms == 0
    assert segs[0].end_ms == 4_000  # 10 words at 2.5 words/sec
    assert segs[1].start_ms > segs[0].end_ms


def test_speaker_header_lines():
    segs = parse_transcript("Alice  0:03\nFirst line\nsecond line\nBob  0:10\nReply")
    assert [(s.speaker, s.start_ms) for s in segs] == [("Alice", 3_000), ("Bob", 10_000)]
    assert segs[0].text == "First line second line"


def test_webvtt_voice_tags_and_merging():
    vtt = """WEBVTT

00:00:01.000 --> 00:00:03.000
<v Alice>Hello and welcome

00:00:03.200 --> 00:00:05.000
<v Alice>to the meeting.

00:00:06.000 --> 00:00:08.000
<v Bob>Thanks!
"""
    segs = parse_transcript(vtt)
    assert detect_format(vtt) == "vtt"
    assert [s.speaker for s in segs] == ["Alice", "Bob"]
    assert segs[0].text == "Hello and welcome to the meeting."
    assert (segs[0].start_ms, segs[0].end_ms) == (1_000, 5_000)


def test_srt():
    srt = "1\n00:00:01,000 --> 00:00:02,500\nAlice: Hi\n\n2\n00:00:03,000 --> 00:00:04,000\nBob: Hey\n"
    segs = parse_transcript(srt)
    assert detect_format(srt) == "srt"
    assert [(s.speaker, s.text, s.start_ms) for s in segs] == [("Alice", "Hi", 1_000), ("Bob", "Hey", 3_000)]


def test_json_variants():
    data = {"segments": [{"speaker": "A", "start": 1.5, "end": 3, "text": "x"},
                         {"speaker_name": "B", "start_ms": 4000, "end_ms": 5000, "text": "y"}]}
    segs = parse_transcript(json.dumps(data))
    assert [(s.speaker, s.start_ms, s.end_ms) for s in segs] == [("A", 1_500, 3_000), ("B", 4_000, 5_000)]


def test_bracket_text_is_not_mistaken_for_json():
    assert detect_format("[00:01] Alice: hi") == "txt"


def test_empty_transcript_rejected():
    with pytest.raises(TranscriptParseError):
        parse_transcript("   ")
