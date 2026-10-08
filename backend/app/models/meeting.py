from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.mixins import TimestampMixin


class Meeting(TimestampMixin, Base):
    __tablename__ = "meetings"
    __table_args__ = (
        Index("ix_meetings_owner_started", "owner_id", "started_at"),
        CheckConstraint("duration_ms >= 0", name="ck_meetings_duration_nonneg"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255))
    started_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    # Where the meeting came from: zoom | google_meet | teams | upload | paste | manual
    platform: Mapped[str] = mapped_column(String(32), default="manual")
    # Optional URL of a recording; when null the frontend uses a simulated player.
    media_url: Mapped[str | None] = mapped_column(String(1024))
    description: Mapped[str | None] = mapped_column(Text)
    language: Mapped[str] = mapped_column(String(32), default="English (Global)")
    # For uploads: the original transcript file (shown in the Uploads list).
    source_filename: Mapped[str | None] = mapped_column(String(255))
    source_size_bytes: Mapped[int | None] = mapped_column(Integer)

    owner = relationship("User")
    participant_links: Mapped[list["MeetingParticipant"]] = relationship(
        back_populates="meeting", cascade="all, delete-orphan", order_by="MeetingParticipant.id"
    )
    channel_links: Mapped[list["MeetingChannel"]] = relationship(back_populates="meeting", cascade="all, delete-orphan")
    segments = relationship(
        "TranscriptSegment", back_populates="meeting", cascade="all, delete-orphan",
        order_by="TranscriptSegment.position", passive_deletes=True,
    )
    summary = relationship("Summary", back_populates="meeting", uselist=False, cascade="all, delete-orphan")
    chapters = relationship(
        "Chapter", back_populates="meeting", cascade="all, delete-orphan", order_by="Chapter.start_ms"
    )
    action_items = relationship(
        "ActionItem", back_populates="meeting", cascade="all, delete-orphan",
        order_by="ActionItem.position", passive_deletes=True,
    )
    comments = relationship("Comment", back_populates="meeting", cascade="all, delete-orphan", passive_deletes=True)
    soundbites = relationship(
        "Soundbite", back_populates="meeting", cascade="all, delete-orphan", passive_deletes=True
    )
    chat_messages = relationship(
        "ChatMessage", back_populates="meeting", cascade="all, delete-orphan", passive_deletes=True,
        order_by="ChatMessage.id",
    )

    @property
    def participants(self) -> list["Participant"]:
        return [link.participant for link in self.participant_links]

    @property
    def channels(self) -> list["Channel"]:
        return [link.channel for link in self.channel_links]

    @property
    def host(self) -> "Participant | None":
        return next((link.participant for link in self.participant_links if link.role == "host"), None)


class Participant(Base):
    """A person who speaks in / attends meetings. Shared across meetings (deduped by email, else name)."""

    __tablename__ = "participants"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    email: Mapped[str | None] = mapped_column(String(255), unique=True)
    color: Mapped[str] = mapped_column(String(9))


class MeetingParticipant(Base):
    """Association meeting <-> participant, carrying the person's role in that meeting."""

    __tablename__ = "meeting_participants"
    __table_args__ = (UniqueConstraint("meeting_id", "participant_id", name="uq_meeting_participant"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), index=True)
    participant_id: Mapped[int] = mapped_column(ForeignKey("participants.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(16), default="attendee")  # host | attendee

    meeting: Mapped[Meeting] = relationship(back_populates="participant_links")
    participant: Mapped[Participant] = relationship(lazy="joined")


class Channel(TimestampMixin, Base):
    """Fireflies-style channel (`#public` or private) used to organize meetings.
    A meeting can live in several channels (M:N via meeting_channels)."""

    __tablename__ = "channels"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(50))
    description: Mapped[str | None] = mapped_column(Text)
    is_private: Mapped[bool] = mapped_column(Boolean, default=False)
    color: Mapped[str] = mapped_column(String(9))

    __table_args__ = (UniqueConstraint("owner_id", "name", name="uq_channel_owner_name"),)


class MeetingChannel(Base):
    __tablename__ = "meeting_channels"

    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), primary_key=True)
    channel_id: Mapped[int] = mapped_column(ForeignKey("channels.id", ondelete="CASCADE"), primary_key=True, index=True)

    meeting: Mapped[Meeting] = relationship(back_populates="channel_links")
    channel: Mapped[Channel] = relationship(lazy="joined")
