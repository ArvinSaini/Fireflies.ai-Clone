"""Participant and tag lookup/creation (deduplicated, with stable colors)."""
from __future__ import annotations

import hashlib

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Participant, Tag

AVATAR_COLORS = [
    "#7C3AED", "#2563EB", "#DB2777", "#059669", "#D97706", "#DC2626",
    "#0891B2", "#4F46E5", "#C026D3", "#65A30D", "#EA580C", "#0D9488",
]
TAG_COLORS = ["#7C3AED", "#2563EB", "#DB2777", "#059669", "#D97706", "#0891B2", "#4F46E5", "#DC2626"]


def color_for(key: str, palette: list[str] = AVATAR_COLORS) -> str:
    digest = hashlib.md5(key.lower().encode()).digest()
    return palette[digest[0] % len(palette)]


def get_or_create_participant(db: Session, name: str, email: str | None = None) -> Participant:
    name = " ".join(name.split())
    email = email.strip().lower() if email else None
    participant = None
    if email:
        participant = db.scalar(select(Participant).where(Participant.email == email))
    if participant is None:
        # Match by name, preferring an existing record with the same (or no) email.
        query = select(Participant).where(func.lower(Participant.name) == name.lower())
        if email:
            query = query.where(Participant.email.is_(None))
        participant = db.scalars(query).first()
        if participant is not None and email:
            participant.email = email
    if participant is None:
        participant = Participant(name=name, email=email, color=color_for(email or name))
        db.add(participant)
        db.flush()
    return participant


def get_or_create_tag(db: Session, name: str) -> Tag:
    name = name.strip()[:50]
    tag = db.scalar(select(Tag).where(func.lower(Tag.name) == name.lower()))
    if tag is None:
        tag = Tag(name=name, color=color_for(name, TAG_COLORS))
        db.add(tag)
        db.flush()
    return tag
