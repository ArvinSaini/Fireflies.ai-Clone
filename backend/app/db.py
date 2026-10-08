"""Database engine, session factory and the SQLite FTS5 search index."""
from collections.abc import Iterator

from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


def _make_engine(url: str) -> Engine:
    engine = create_engine(url, connect_args={"check_same_thread": False} if url.startswith("sqlite") else {})

    if url.startswith("sqlite"):
        @event.listens_for(engine, "connect")
        def _sqlite_pragmas(dbapi_conn, _record):  # pragma: no cover - trivial
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA foreign_keys = ON")  # enforce ON DELETE CASCADE
            cur.execute("PRAGMA journal_mode = WAL")
            cur.close()

    return engine


engine = _make_engine(get_settings().database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --- Full-text search -------------------------------------------------------
# An external-content FTS5 table mirrors transcript_segments.text. Triggers keep
# it in sync, so application code never writes to it directly.
FTS_DDL = [
    """
    CREATE VIRTUAL TABLE IF NOT EXISTS segments_fts USING fts5(
        text, content='transcript_segments', content_rowid='id', tokenize='porter unicode61'
    )
    """,
    """
    CREATE TRIGGER IF NOT EXISTS segments_ai AFTER INSERT ON transcript_segments BEGIN
        INSERT INTO segments_fts(rowid, text) VALUES (new.id, new.text);
    END
    """,
    """
    CREATE TRIGGER IF NOT EXISTS segments_ad AFTER DELETE ON transcript_segments BEGIN
        INSERT INTO segments_fts(segments_fts, rowid, text) VALUES ('delete', old.id, old.text);
    END
    """,
    """
    CREATE TRIGGER IF NOT EXISTS segments_au AFTER UPDATE OF text ON transcript_segments BEGIN
        INSERT INTO segments_fts(segments_fts, rowid, text) VALUES ('delete', old.id, old.text);
        INSERT INTO segments_fts(rowid, text) VALUES (new.id, new.text);
    END
    """,
]


def init_db(bind: Engine | None = None) -> None:
    """Create all tables plus the FTS index (idempotent)."""
    from app import models  # noqa: F401  - register models on Base.metadata

    bind = bind or engine
    Base.metadata.create_all(bind)
    if bind.url.get_backend_name() == "sqlite":
        with bind.begin() as conn:
            for stmt in FTS_DDL:
                conn.execute(text(stmt))
