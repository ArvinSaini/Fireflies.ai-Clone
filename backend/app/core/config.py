"""Application settings, loaded from environment variables (or a .env file)."""
from functools import lru_cache
from pathlib import Path

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

    # Optional LLM. When unset, the heuristic summarizer / Q&A engine is used.
    anthropic_api_key: str | None = None
    llm_model: str = "claude-opus-5-5"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def llm_enabled(self) -> bool:
        return bool(self.anthropic_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
