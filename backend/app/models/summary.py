from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.mixins import utcnow


class Summary(Base):
    """AI summary for a meeting (1:1, keyed by meeting_id).

    `notes` is a JSON document rendered as a unit:
        [{"heading": str, "start_ms": int, "bullets": [str]}]
    It is never filtered or joined on, so it is stored as JSON rather than normalized rows.
    """

    __tablename__ = "summaries"

    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), primary_key=True)
    overview: Mapped[str] = mapped_column(Text, default="")
    keywords: Mapped[list[str]] = mapped_column(JSON, default=list)
    notes: Mapped[list[dict]] = mapped_column(JSON, default=list)
    generated_by: Mapped[str] = mapped_column(String(32), default="heuristic")  # seed | heuristic | llm | user
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    meeting = relationship("Meeting", back_populates="summary")


class Chapter(Base):
    """Outline entry: a titled time range of the meeting."""

    __tablename__ = "chapters"

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    start_ms: Mapped[int] = mapped_column(Integer)
    end_ms: Mapped[int] = mapped_column(Integer)

    meeting = relationship("Meeting", back_populates="chapters")
