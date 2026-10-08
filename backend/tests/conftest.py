import os
import tempfile
from pathlib import Path

# Throwaway SQLite file; must be set before app modules read settings.
_TMP = Path(tempfile.mkdtemp()) / "test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP.as_posix()}"
os.environ["SEED_ON_STARTUP"] = "false"
os.environ["ANTHROPIC_API_KEY"] = ""

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, SessionLocal, engine, init_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import User  # noqa: E402

SAMPLE_TRANSCRIPT = """[00:00:00] Sarah Chen: Welcome everyone, let's review the pricing page redesign and the launch timeline.
[00:00:08] Marcus Johnson: The pricing page redesign is mostly done. The pricing toggle needs another pass.
[00:00:16] Sarah Chen: Great. Marcus, can you send the updated pricing mockups by Friday?
[00:00:21] Marcus Johnson: Sure, I'll send the pricing mockups by Friday.
[00:00:26] Priya Patel: I'll schedule a usability test for the launch timeline next week.
[00:00:33] Sarah Chen: We need to finalize the launch timeline before the board meeting. What do you think about 20% discount?
[00:00:41] Marcus Johnson: The 20% discount sounds right for the launch.
"""


@pytest.fixture()
def client():
    init_db()
    with SessionLocal() as db:
        db.add(User(id=1, name="Sarah Chen", email="sarah@acme.io"))
        db.commit()
    with TestClient(app) as c:
        yield c
    with engine.begin() as conn:
        conn.exec_driver_sql("DROP TABLE IF EXISTS segments_fts")
    Base.metadata.drop_all(engine)


@pytest.fixture()
def channel(client):
    res = client.post("/api/channels", json={"name": "Product"})
    assert res.status_code == 201, res.text
    return res.json()


@pytest.fixture()
def meeting(client, channel):
    res = client.post("/api/meetings", json={
        "title": "Pricing Sync", "participants": [{"name": "Sarah Chen", "email": "sarah@acme.io"}],
        "channel_ids": [channel["id"]], "transcript_text": SAMPLE_TRANSCRIPT,
    })
    assert res.status_code == 201, res.text
    return res.json()
