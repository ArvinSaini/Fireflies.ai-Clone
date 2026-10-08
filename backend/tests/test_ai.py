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


def test_notes_skip_small_talk_and_use_third_person():
    from app.services.ai.heuristic import third_person

    assert third_person("I'll send the deck by Friday.", "Ben Carter") == "Ben will send the deck by Friday."
    assert third_person("We need to fix my report.", "Ann Lee") == "The team needs to fix my report."
    assert third_person("I am updating my notes.", "Ann Lee") == "Ann is updating their notes."
    lines = [
        Line(0, "Nina", 0, 4000, "Thanks for joining the partner onboarding review today everyone."),
        Line(1, "Ben", 4000, 9000, "Activation is up twelve percent since the new onboarding checklist shipped."),
        Line(2, "Ben", 9000, 14000, "I'll send the onboarding funnel breakdown by Friday with the drop-off screens."),
    ]
    draft = HeuristicSummarizer().summarize(MeetingContext("Review", ["Nina", "Ben"], lines))
    assert "Thanks for joining" not in draft.overview
    assert "Ben will send the onboarding funnel breakdown" in draft.overview
    assert "Friday" not in draft.keywords
