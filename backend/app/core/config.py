"""Application settings, loaded from environment variables (or a .env file)."""
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    app_name: str = "Fireflies Clone API"
    database_url: str = f"sqlite:///{(BASE_DIR / 'fireflies.db').as_posix()}"
    # Comma-separated list of allowed origins for the Next.js frontend.
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    # Optional regex (e.g. Vercel preview URLs): r"https://.*\.vercel\.app"
    cors_origin_regex: str | None = None
    seed_on_startup: bool = True

    # Optional LLM. With no key the built-in heuristic summarizer / Q&A engine is used.
    # "auto" picks Claude if its key is set, else Gemini if its key is set, else the heuristic engine.
    ai_provider: Literal["auto", "claude", "gemini", "heuristic"] = "auto"
    anthropic_api_key: str | None = None
    claude_model: str = "claude-opus-5-5"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def llm_provider(self) -> Literal["claude", "gemini"] | None:
        """Which LLM to use, or None for the heuristic engine (a forced provider still needs its key)."""
        claude, gemini = bool(self.anthropic_api_key), bool(self.gemini_api_key)
        if self.ai_provider == "claude":
            return "claude" if claude else None
        if self.ai_provider == "gemini":
            return "gemini" if gemini else None
        if self.ai_provider == "heuristic":
            return None
        return "claude" if claude else "gemini" if gemini else None

    @property
    def llm_enabled(self) -> bool:
        return self.llm_provider is not None


@lru_cache
def get_settings() -> Settings:
    return Settings()
