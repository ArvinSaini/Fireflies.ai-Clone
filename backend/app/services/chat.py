"""AskFred: per-meeting Q&A with persisted history."""
from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import ChatMessage, Meeting
from app.services.ai import get_assistant
from app.services.meetings import build_context


def history(db: Session, meeting_id: int) -> list[ChatMessage]:
    return list(db.scalars(select(ChatMessage).where(ChatMessage.meeting_id == meeting_id).order_by(ChatMessage.id)))


def ask(db: Session, meeting: Meeting, question: str) -> tuple[ChatMessage, ChatMessage]:
    ctx, segments = build_context(db, meeting)
    past = [(m.role, m.content) for m in history(db, meeting.id)]
    draft = get_assistant().answer(ctx, question, past)

    citations = []
    for idx in draft.line_indexes:
        seg = segments[idx]
        citations.append({"segment_id": seg.id, "start_ms": seg.start_ms,
                          "speaker": seg.speaker.name if seg.speaker else None, "text": seg.text})

    q = ChatMessage(meeting_id=meeting.id, role="user", content=question.strip())
    a = ChatMessage(meeting_id=meeting.id, role="assistant", content=draft.answer, citations=citations)
    db.add_all([q, a])
    db.commit()
    return q, a


def clear(db: Session, meeting_id: int) -> None:
    db.execute(delete(ChatMessage).where(ChatMessage.meeting_id == meeting_id))
    db.commit()
