"""Global search across meeting titles and transcripts.

Transcript search uses the SQLite FTS5 index (`segments_fts`, see app/db.py) with
porter stemming and `snippet()` highlighting. If FTS is unavailable (non-SQLite DB)
it falls back to a LIKE scan.
"""
from __future__ import annotations

import html
import re

from sqlalchemy import func, select, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.models import Meeting, TranscriptSegment
from app.schemas.transcript import SearchHit, SearchResults

MARK_OPEN, MARK_CLOSE = "\x02", "\x03"  # sentinels, swapped for <mark> after HTML-escaping


def _fts_query(q: str) -> str | None:
    """User text -> safe FTS5 query: every term must match, last term as prefix."""
    terms = re.findall(r"[\w']+", q.lower())
    if not terms:
        return None
    quoted = [f'"{t}"' for t in terms]
    quoted[-1] += "*"
    return " AND ".join(quoted)


def _to_html(snippet: str) -> str:
    return html.escape(snippet).replace(MARK_OPEN, "<mark>").replace(MARK_CLOSE, "</mark>")


def _highlight(text_: str, q: str, width: int = 160) -> str:
    """Fallback highlighter for title hits / LIKE search."""
    idx = text_.lower().find(q.lower())
    if idx < 0:
        return html.escape(text_[:width])
    start = max(0, idx - width // 3)
    chunk = text_[start: start + width]
    rel = idx - start
    out = html.escape(chunk[:rel]) + "<mark>" + html.escape(chunk[rel: rel + len(q)]) + "</mark>" + html.escape(chunk[rel + len(q):])
    return ("…" if start else "") + out + ("…" if start + width < len(text_) else "")


def search(db: Session, owner_id: int, q: str, limit: int = 50) -> SearchResults:
    q = q.strip()
    hits: list[SearchHit] = []
    if not q:
        return SearchResults(query=q, total=0, hits=[])

    for m in db.scalars(
        select(Meeting).where(Meeting.owner_id == owner_id, func.lower(Meeting.title).like(f"%{q.lower()}%"))
        .order_by(Meeting.started_at.desc()).limit(10)
    ):
        hits.append(SearchHit(meeting_id=m.id, meeting_title=m.title, meeting_started_at=m.started_at,
                              segment_id=None, start_ms=None, speaker=None, snippet=_highlight(m.title, q), kind="title"))

    rows = _search_segments_fts(db, owner_id, q, limit)
    if rows is None:
        rows = _search_segments_like(db, owner_id, q, limit)
    hits.extend(rows)
    return SearchResults(query=q, total=len(hits), hits=hits)


def _search_segments_fts(db: Session, owner_id: int, q: str, limit: int) -> list[SearchHit] | None:
    fts_q = _fts_query(q)
    if fts_q is None:
        return []
    sql = text(f"""
        SELECT s.id, s.start_ms, s.meeting_id, m.title, m.started_at, p.name,
               snippet(segments_fts, 0, '{MARK_OPEN}', '{MARK_CLOSE}', '…', 24) AS snip
        FROM segments_fts
        JOIN transcript_segments s ON s.id = segments_fts.rowid
        JOIN meetings m ON m.id = s.meeting_id
        LEFT JOIN participants p ON p.id = s.participant_id
        WHERE segments_fts MATCH :q AND m.owner_id = :owner
        ORDER BY bm25(segments_fts), m.started_at DESC
        LIMIT :limit
    """)
    try:
        rows = db.execute(sql, {"q": fts_q, "owner": owner_id, "limit": limit}).all()
    except OperationalError:
        return None
    return [
        SearchHit(meeting_id=r[2], meeting_title=r[3], meeting_started_at=r[4], segment_id=r[0], start_ms=r[1],
                  speaker=r[5], snippet=_to_html(r[6]), kind="transcript")
        for r in rows
    ]


def _search_segments_like(db: Session, owner_id: int, q: str, limit: int) -> list[SearchHit]:
    rows = db.execute(
        select(TranscriptSegment, Meeting)
        .join(Meeting, Meeting.id == TranscriptSegment.meeting_id)
        .where(Meeting.owner_id == owner_id, func.lower(TranscriptSegment.text).like(f"%{q.lower()}%"))
        .order_by(Meeting.started_at.desc(), TranscriptSegment.position)
        .limit(limit)
    ).all()
    return [
        SearchHit(meeting_id=m.id, meeting_title=m.title, meeting_started_at=m.started_at, segment_id=s.id,
                  start_ms=s.start_ms, speaker=s.speaker.name if s.speaker else None,
                  snippet=_highlight(s.text, q), kind="transcript")
        for s, m in rows
    ]
