from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.mixins import utcnow


class TranscriptSegment(Base):
    """One utterance in a transcript: who said what, and when (ms from meeting start)."""

    __tablename__ = "transcript_segments"
    __table_args__ = (
        Index("ix_segments_meeting_position", "meeting_id", "position", unique=True),
        Index("ix_segments_meeting_start", "meeting_id", "start_ms"),
        CheckConstraint("end_ms >= start_ms", name="ck_segments_time_order"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"))
    participant_id: Mapped[int | None] = mapped_column(ForeignKey("participants.id", ondelete="SET NULL"))
    position: Mapped[int] = mapped_column(Integer)
    start_ms: Mapped[int] = mapped_column(Integer)
    end_ms: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)

    meeting = relationship("Meeting", back_populates="segments")
    speaker = relationship("Participant", lazy="joined")


class Comment(Base):
    """A user comment pinned to a transcript segment."""

    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), index=True)
    segment_id: Mapped[int] = mapped_column(ForeignKey("transcript_segments.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    meeting = relationship("Meeting", back_populates="comments")
    author = relationship("User", lazy="joined")


class Soundbite(Base):
    """A highlighted clip of the meeting: a time range, optionally anchored to a segment."""

    __tablename__ = "soundbites"
    __table_args__ = (CheckConstraint("end_ms > start_ms", name="ck_soundbites_time_order"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), index=True)
    segment_id: Mapped[int | None] = mapped_column(ForeignKey("transcript_segments.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(255))
    start_ms: Mapped[int] = mapped_column(Integer)
    end_ms: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    meeting = relationship("Meeting", back_populates="soundbites")
