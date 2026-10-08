"""FastAPI application factory."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import (
    action_items,
    askfred,
    assistant,
    channels,
    meetings,
    topic_trackers,
    transcript,
    workspace,
)
from app.core.config import get_settings
from app.db import init_db
from app.services.errors import Conflict, DomainError, InvalidInput, NotFound

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    if get_settings().seed_on_startup:
        from app.seed.loader import seed_if_empty

        seed_if_empty()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_origin_regex=settings.cors_origin_regex,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition"],
    )
    @app.exception_handler(DomainError)
    async def domain_error(_: Request, exc: DomainError) -> JSONResponse:
        """Services raise domain errors; this is the only place they become HTTP status codes."""
        code = (status.HTTP_404_NOT_FOUND if isinstance(exc, NotFound)
                else status.HTTP_409_CONFLICT if isinstance(exc, Conflict)
                else status.HTTP_422_UNPROCESSABLE_CONTENT if isinstance(exc, InvalidInput)
                else status.HTTP_400_BAD_REQUEST)
        return JSONResponse({"detail": str(exc)}, status_code=code)

    for module in (workspace, channels, topic_trackers, meetings, action_items, transcript, assistant, askfred):
        app.include_router(module.router, prefix="/api")

    @app.get("/api/health", tags=["meta"])
    def health():
        return {"status": "ok"}

    return app


app = create_app()
