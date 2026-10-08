from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.mixins import TimestampMixin


class User(TimestampMixin, Base):
    """Workspace user. Auth is out of scope: a single default user (id=1) is assumed."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    avatar_color: Mapped[str] = mapped_column(String(9), default="#7C3AED")
