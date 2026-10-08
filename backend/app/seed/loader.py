"""Seed the database with the default user and sample meetings from seed/data/*.json.

Seed files hold hand-written transcripts plus their summaries/action items, so the
app is immediately usable. Run directly to (re)seed:  python -m app.seed.loader --reset
"""
from __future__ import annotations

import argparse
import bisect
import json
import logging
from datetime import datetime, time, timedelta
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import Base, SessionLocal, engine, init_db
from app.models import Comment, Meeting, Soundbite, TopicTracker, User
from app.models.mixins import utcnow
from app.schemas.meeting import MeetingCreate
from app.services import meetings as svc
from app.services.ai.types import ActionItemDraft, ChapterDraft, SummaryDraft
from app.services.people import CHANNEL_COLORS, color_for, get_or_create_channel
from app.services.transcript_parser import ParsedSegment

log = logging.getLogger(__name__)
DATA_DIR = Path(__file__).parent / "data"

DEFAULT_USER = {"id": 1, "name": "Arvin Saini", "email": "arvin@acme.io", "avatar_color": "#7C3AED"}
PRIVATE_CHANNELS = {"1:1", "Hiring"}
DEFAULT_TRACKERS = {
    "Pricing": ["price", "pricing", "discount", "budget", "cost"],
    "Competitors": ["competitor", "Zapier", "Make", "Workato"],
    "Security": ["SSO", "SOC 2", "audit", "security", "compliance"],
}


def _ms(seconds: float | None) -> int | None:
    return None if seconds is None else int(round(float(seconds) * 1000))


def load_meeting(db: Session, owner: User, spec: dict) -> Meeting:
    people = {p["email"]: p["name"] for p in spec["participants"]}
    day = (utcnow() - timedelta(days=spec.get("days_ago", 0))).date()
    started = datetime.combine(day, time(spec.get("start_hour", 10), spec.get("start_minute", 0)))

    # The host goes first so create_meeting gives them the host role.
    ordered = sorted(spec["participants"], key=lambda p: p.get("role") != "host")
    channels = [get_or_create_channel(db, owner.id, name, is_private=name in PRIVATE_CHANNELS).id
                for name in spec.get("tags", [])]
    data = MeetingCreate(
        title=spec["title"], started_at=started, platform=spec.get("platform", "zoom"),
        participants=[{"name": p["name"], "email": p["email"]} for p in ordered],
        channel_ids=channels, generate_summary=False,
    )
    parsed = [
        ParsedSegment(people.get(s["speaker"], s["speaker"]), s["text"], _ms(s["start"]), _ms(s["end"]))
        for s in spec["segments"]
    ]
    meeting = svc.create_meeting(db, owner, data, parsed)
    _, segments = svc.build_context(db, meeting)
    starts = [seg.start_ms for seg in segments]

    def line_at(seconds: float | None) -> int | None:
        if seconds is None or not starts:
            return None
        return max(0, bisect.bisect_right(starts, _ms(seconds)) - 1)

    summary = spec.get("summary", {})
    draft = SummaryDraft(
        overview=summary.get("overview", ""),
        keywords=summary.get("keywords", []),
        notes=[{"heading": n["heading"], "start_ms": _ms(n.get("start")), "bullets": n["bullets"]}
               for n in summary.get("notes", [])],
        chapters=[ChapterDraft(c["title"], c.get("description", ""), _ms(c["start"]), _ms(c["end"]))
                  for c in spec.get("chapters", [])],
        action_items=[ActionItemDraft(a["text"], people.get(a.get("assignee") or ""), line_at(a.get("start")))
                      for a in spec.get("action_items", [])],
        engine="seed",
    )
    svc.apply_summary(db, meeting, draft, segments)
    db.flush()

    # Completion state / due dates from the seed file (apply_summary creates open items).
    db.refresh(meeting)
    for item, a in zip(meeting.action_items, spec.get("action_items", [])):
        if a.get("completed"):
            item.is_completed = True
            item.completed_at = started + timedelta(days=1)
        if a.get("due_in_days") is not None:
            item.due_date = (started + timedelta(days=a["due_in_days"])).date()
    db.commit()
    return meeting


def _sample_collaboration(db: Session, user: User, meeting: Meeting) -> None:
    """A comment and a soundbite on the newest meeting, to showcase those features."""
    _, segments = svc.build_context(db, meeting)
    if len(segments) < 6:
        return
    seg = segments[min(5, len(segments) - 1)]
    db.add(Comment(meeting_id=meeting.id, segment_id=seg.id, author_id=user.id,
                   body="Great point — let's make sure this lands in the follow-up email."))
    first_item = next((a for a in meeting.action_items if a.segment_id), None)
    anchor = next((s for s in segments if first_item and s.id == first_item.segment_id), segments[2])
    db.add(Soundbite(meeting_id=meeting.id, segment_id=anchor.id, title="Key commitment",
                     start_ms=anchor.start_ms, end_ms=max(anchor.end_ms, anchor.start_ms + 5000)))
    db.commit()


def seed(db: Session) -> int:
    user = db.get(User, DEFAULT_USER["id"])
    if user is None:
        user = User(**DEFAULT_USER)
        db.add(user)
        db.commit()

    for name, keywords in DEFAULT_TRACKERS.items():
        db.add(TopicTracker(owner_id=user.id, name=name, keywords=keywords, color=color_for(name, CHANNEL_COLORS)))
    db.commit()

    files = sorted(DATA_DIR.glob("*.json"))
    loaded = []
    for path in files:
        spec = json.loads(path.read_text(encoding="utf-8"))
        loaded.append(load_meeting(db, user, spec))
        log.info("Seeded %s", spec["title"])
    if loaded:
        newest = max(loaded, key=lambda m: m.started_at)
        _sample_collaboration(db, user, svc.get_meeting(db, newest.id, user.id))
    return len(loaded)


def seed_if_empty() -> None:
    with SessionLocal() as db:
        if db.scalar(select(func.count()).select_from(Meeting)) == 0 and db.get(User, 1) is None:
            count = seed(db)
            log.info("Seeded %d meetings", count)


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the Fireflies clone database")
    parser.add_argument("--reset", action="store_true", help="drop all tables first")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    if args.reset:
        from sqlalchemy import text

        with engine.begin() as conn:
            conn.execute(text("DROP TABLE IF EXISTS segments_fts"))
        Base.metadata.drop_all(engine)
    init_db()
    with SessionLocal() as db:
        print(f"Seeded {seed(db)} meetings")


if __name__ == "__main__":
    main()
