from sqlalchemy import JSON, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.mixins import TimestampMixin


class TopicTracker(TimestampMixin, Base):
    """Workspace-level keyword group (e.g. "Pricing": ["price", "discount", "budget"]).
    Smart Search counts and highlights mentions of these keywords in every meeting."""

    __tablename__ = "topic_trackers"
    __table_args__ = (UniqueConstraint("owner_id", "name", name="uq_tracker_owner_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(60))
    keywords: Mapped[list[str]] = mapped_column(JSON, default=list)
    color: Mapped[str] = mapped_column(String(9))
