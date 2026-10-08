"""LLM providers behind one tiny interface: `parse(system, prompt, schema) -> validated Pydantic model`.

The summarizer/assistant in `llm.py` only talk to this interface, so adding a vendor means adding one
class here. Gemini is called over its REST API with the standard library (no extra dependency).
"""
from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from typing import Protocol, TypeVar

from pydantic import BaseModel, ValidationError

T = TypeVar("T", bound=BaseModel)


class LLMError(RuntimeError):
    """Any provider failure (network, HTTP error, refusal, invalid JSON). Triggers the heuristic fallback."""


class StructuredLLM(Protocol):
    name: str  # recorded as summaries.generated_by ("claude" | "gemini")

    def parse(self, system: str, prompt: str, schema: type[T]) -> T: ...


class ClaudeProvider:
    """Anthropic Claude via the official SDK, using structured outputs (`messages.parse`)."""

    name = "claude"

    def __init__(self, api_key: str, model: str):
        import anthropic  # imported lazily: only needed when a Claude key is configured

        self.client = anthropic.Anthropic(api_key=api_key, max_retries=1, timeout=90)
        self.model = model

    def parse(self, system: str, prompt: str, schema: type[T]) -> T:
        response = self.client.messages.parse(
            model=self.model,
            max_tokens=16000,
            system=system,
            messages=[{"role": "user", "content": prompt}],
            output_config={"effort": "low"},
            output_format=schema,
        )
        if response.stop_reason == "refusal" or response.parsed_output is None:
            raise LLMError(f"Claude returned no usable output (stop_reason={response.stop_reason})")
        return response.parsed_output


class GeminiProvider:
    """Google Gemini via the REST `generateContent` endpoint in JSON mode.

    The expected JSON Schema is given in the system instruction and the reply is validated with Pydantic,
    so a malformed answer raises LLMError (and the caller falls back) instead of producing bad data.
    """

    name = "gemini"
    BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

    def __init__(self, api_key: str, model: str, timeout: float = 90):
        self.api_key = api_key
        self.model = model
        self.timeout = timeout

    def build_request(self, system: str, prompt: str, schema: type[BaseModel]) -> urllib.request.Request:
        instruction = (
            f"{system}\n\nRespond ONLY with a JSON object that matches this JSON Schema "
            f"(no markdown, no commentary):\n{json.dumps(schema.model_json_schema())}"
        )
        body = {
            "systemInstruction": {"parts": [{"text": instruction}]},
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2},
        }
        return urllib.request.Request(
            f"{self.BASE_URL}/{self.model}:generateContent",
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json", "x-goog-api-key": self.api_key},
            method="POST",
        )

    @staticmethod
    def extract_text(payload: dict) -> str:
        candidates = payload.get("candidates") or []
        if not candidates:
            reason = (payload.get("promptFeedback") or {}).get("blockReason", "no candidates")
            raise LLMError(f"Gemini returned no answer ({reason})")
        candidate = candidates[0]
        if candidate.get("finishReason") not in (None, "STOP", "MAX_TOKENS"):
            raise LLMError(f"Gemini stopped early ({candidate.get('finishReason')})")
        parts = (candidate.get("content") or {}).get("parts") or []
        text = "".join(p.get("text", "") for p in parts).strip()
        # Tolerate an accidental ```json fence around the object.
        return re.sub(r"^```(?:json)?\s*|\s*```$", "", text)

    def parse(self, system: str, prompt: str, schema: type[T]) -> T:
        request = self.build_request(system, prompt, schema)
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:  # noqa: S310 - fixed https URL
                payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "replace")[:300]
            raise LLMError(f"Gemini HTTP {exc.code}: {detail}") from exc
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise LLMError(f"Gemini request failed: {exc}") from exc
        try:
            return schema.model_validate_json(self.extract_text(payload))
        except ValidationError as exc:
            raise LLMError(f"Gemini returned JSON that doesn't match the schema: {exc.error_count()} errors") from exc
