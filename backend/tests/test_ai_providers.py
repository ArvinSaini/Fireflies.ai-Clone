"""LLM provider tests — no network: a fake provider and a mocked urlopen stand in for the APIs."""
import io
import json
import urllib.error

import pytest

from app.core.config import Settings
from app.services.ai import _WithFallback, build_provider, engine_name
from app.services.ai.heuristic import HeuristicSummarizer
from app.services.ai.llm import LLMAssistant, LLMSummarizer, _Answer, _Summary
from app.services.ai.providers import ClaudeProvider, GeminiProvider, LLMError
from app.services.ai.types import Line, MeetingContext

LINES = [
    Line(0, "Sarah Chen", 0, 8_000, "Let's review the launch timeline and pricing."),
    Line(1, "Marcus Johnson", 8_000, 15_000, "I'll send the pricing mockups by Friday."),
    Line(2, "Sarah Chen", 15_000, 22_000, "We need to finalize the launch date next week."),
]
CTX = MeetingContext("Launch sync", ["Sarah Chen", "Marcus Johnson"], LINES)


class FakeProvider:
    name = "gemini"

    def __init__(self, result=None, error=None):
        self.result, self.error, self.calls = result, error, []

    def parse(self, system, prompt, schema):
        self.calls.append((system, prompt, schema))
        if self.error:
            raise self.error
        return self.result


# --- provider selection ---------------------------------------------------------

@pytest.mark.parametrize(
    ("kwargs", "expected"),
    [
        ({}, None),
        ({"gemini_api_key": "g"}, "gemini"),
        ({"anthropic_api_key": "a"}, "claude"),
        ({"anthropic_api_key": "a", "gemini_api_key": "g"}, "claude"),  # auto prefers Claude
        ({"anthropic_api_key": "a", "gemini_api_key": "g", "ai_provider": "gemini"}, "gemini"),
        ({"anthropic_api_key": "a", "ai_provider": "heuristic"}, None),
        ({"ai_provider": "gemini"}, None),  # forced provider without its key → heuristic
    ],
)
def test_provider_selection(kwargs, expected):
    settings = Settings(_env_file=None, **kwargs)
    assert settings.llm_provider == expected
    assert engine_name(settings) == (expected or "heuristic")


def test_build_provider_types():
    assert build_provider(Settings(_env_file=None)) is None
    assert isinstance(build_provider(Settings(_env_file=None, gemini_api_key="g")), GeminiProvider)
    assert isinstance(build_provider(Settings(_env_file=None, anthropic_api_key="a")), ClaudeProvider)


# --- provider-agnostic LLM summarizer / assistant -------------------------------

def test_llm_summarizer_maps_line_numbers_to_times():
    out = _Summary(
        overview="The team planned the launch.",
        keywords=["launch", "pricing"],
        notes=[{"heading": "🚀 Launch", "start_line": 0, "bullets": ["Launch date to be finalized"]}],
        chapters=[{"title": "Timeline", "description": "Launch planning", "start_line": 0},
                  {"title": "Pricing", "description": "Mockups", "start_line": 1}],
        action_items=[{"text": "Send pricing mockups", "assignee": "Marcus Johnson", "line": 1}],
    )
    provider = FakeProvider(result=out)
    draft = LLMSummarizer(provider).summarize(CTX)
    assert draft.engine == "gemini"
    assert [(c.title, c.start_ms, c.end_ms) for c in draft.chapters] == [("Timeline", 0, 8_000), ("Pricing", 8_000, 22_000)]
    assert draft.action_items[0].line_index == 1 and draft.action_items[0].assignee == "Marcus Johnson"
    assert "L1 [00:08] Marcus Johnson" in provider.calls[0][1]  # transcript rendered with line numbers


def test_llm_assistant_drops_invalid_citations():
    provider = FakeProvider(result=_Answer(answer="Marcus will send mockups.", cited_lines=[1, 99]))
    ans = LLMAssistant(provider).answer(CTX, "Who sends the mockups?", [])
    assert ans.line_indexes == [1] and ans.engine == "gemini"


def test_fallback_to_heuristic_on_provider_error():
    failing = LLMSummarizer(FakeProvider(error=LLMError("quota exceeded")))
    draft = _WithFallback(failing, HeuristicSummarizer()).summarize(CTX)
    assert draft.engine == "heuristic" and draft.overview


# --- Gemini REST provider ------------------------------------------------------------

class _Resp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def _gemini_payload(text, finish="STOP"):
    return {"candidates": [{"finishReason": finish, "content": {"parts": [{"text": text}]}}]}


def test_gemini_request_shape():
    req = GeminiProvider("KEY", "gemini-test").build_request("Be brief.", "Q?", _Answer)
    body = json.loads(req.data)
    assert req.full_url.endswith("/models/gemini-test:generateContent")
    assert req.get_header("X-goog-api-key") == "KEY"
    assert body["generationConfig"]["responseMimeType"] == "application/json"
    assert '"cited_lines"' in body["systemInstruction"]["parts"][0]["text"]  # JSON Schema embedded
    assert body["contents"][0]["parts"][0]["text"] == "Q?"


def test_gemini_parse_success_and_code_fence(monkeypatch):
    answer = {"answer": "Yes", "cited_lines": [0]}
    for text in (json.dumps(answer), f"```json\n{json.dumps(answer)}\n```"):
        monkeypatch.setattr("urllib.request.urlopen",
                            lambda req, timeout=None, t=text: _Resp(json.dumps(_gemini_payload(t)).encode()))
        assert GeminiProvider("k", "m").parse("s", "p", _Answer) == _Answer(**answer)


@pytest.mark.parametrize(
    "payload",
    [
        _gemini_payload('{"answer": "x"}'),                       # missing required field
        _gemini_payload('{"answer": "x", "cited_lines": []}', finish="SAFETY"),  # blocked
        {"promptFeedback": {"blockReason": "SAFETY"}},             # no candidates
    ],
)
def test_gemini_bad_responses_raise(monkeypatch, payload):
    monkeypatch.setattr("urllib.request.urlopen", lambda req, timeout=None: _Resp(json.dumps(payload).encode()))
    with pytest.raises(LLMError):
        GeminiProvider("k", "m").parse("s", "p", _Answer)


def test_gemini_http_error_raises(monkeypatch):
    def boom(req, timeout=None):
        raise urllib.error.HTTPError(req.full_url, 429, "Too Many Requests", {}, io.BytesIO(b'{"error":"quota"}'))

    monkeypatch.setattr("urllib.request.urlopen", boom)
    with pytest.raises(LLMError, match="HTTP 429"):
        GeminiProvider("k", "m").parse("s", "p", _Answer)
