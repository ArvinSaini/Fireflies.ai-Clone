from app.services.ai.heuristic import HeuristicAssistant, HeuristicSummarizer, extract_action_items
from app.services.ai.types import Line, MeetingContext
from app.services.transcript_parser import parse_transcript
from tests.conftest import SAMPLE_TRANSCRIPT


def _ctx() -> MeetingContext:
    segs = parse_transcript(SAMPLE_TRANSCRIPT)
    lines = [Line(i, s.speaker, s.start_ms, s.end_ms, s.text) for i, s in enumerate(segs)]
    return MeetingContext("Pricing Sync", ["Sarah Chen", "Marcus Johnson", "Priya Patel"], lines)


def test_action_items_detect_commitments_and_assignees():
    ctx = _ctx()
    items = extract_action_items(ctx.lines, ctx.participants)
    by_text = {i.text: i.assignee for i in items}
    assert by_text["Send the updated pricing mockups by Friday"] == "Marcus Johnson"
    assert by_text["Schedule a usability test for the launch timeline next week"] == "Priya Patel"
    assert any(t.startswith("Finalize the launch timeline") for t in by_text)
    # "I'll send the pricing mockups by Friday" duplicates the request above
    assert sum("mockups" in t for t in by_text) == 1


def test_summary_has_all_sections():
    draft = HeuristicSummarizer().summarize(_ctx())
    assert draft.overview.startswith("Sarah, Marcus and Priya met to discuss")
    assert "Pricing" in " ".join(draft.keywords)
    assert draft.chapters and draft.chapters[0].start_ms == 0
    assert draft.action_items


def test_assistant_answers_with_citations():
    ans = HeuristicAssistant().answer(_ctx(), "What did they say about the discount?", [])
    assert ans.line_indexes and "discount" in ans.answer.lower()
    talk = HeuristicAssistant().answer(_ctx(), "Who talked the most?", [])
    assert talk.answer.startswith("Talk time by speaker")
