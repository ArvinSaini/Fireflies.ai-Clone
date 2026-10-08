"""ORM -> response schema mapping for shapes that aren't a 1:1 copy of a table."""
from app.models import Meeting
from app.schemas.common import ActionItemOut, MeetingParticipantOut, ParticipantOut, TagOut
from app.schemas.meeting import ChapterOut, MeetingDetail, MeetingListItem, SummaryOut


def participants_out(meeting: Meeting) -> list[MeetingParticipantOut]:
    out = [
        MeetingParticipantOut(**ParticipantOut.model_validate(link.participant).model_dump(), role=link.role)
        for link in meeting.participant_links
    ]
    return sorted(out, key=lambda p: (p.role != "host", p.name.lower()))


def tags_out(meeting: Meeting) -> list[TagOut]:
    return sorted((TagOut.model_validate(t) for t in meeting.tags), key=lambda t: t.name.lower())


def meeting_list_item(meeting: Meeting, total_items: int, open_items: int) -> MeetingListItem:
    return MeetingListItem(
        id=meeting.id, title=meeting.title, started_at=meeting.started_at, duration_ms=meeting.duration_ms,
        platform=meeting.platform, participants=participants_out(meeting), tags=tags_out(meeting),
        overview=meeting.summary.overview if meeting.summary else None,
        action_items_total=total_items, action_items_open=open_items,
    )


def meeting_detail(meeting: Meeting, segment_count: int, comment_count: int) -> MeetingDetail:
    return MeetingDetail(
        id=meeting.id, title=meeting.title, description=meeting.description, started_at=meeting.started_at,
        duration_ms=meeting.duration_ms, platform=meeting.platform, media_url=meeting.media_url,
        created_at=meeting.created_at, updated_at=meeting.updated_at,
        participants=participants_out(meeting), tags=tags_out(meeting),
        summary=SummaryOut.model_validate(meeting.summary) if meeting.summary else None,
        chapters=[ChapterOut.model_validate(c) for c in meeting.chapters],
        action_items=[ActionItemOut.model_validate(a) for a in meeting.action_items],
        segment_count=segment_count, comment_count=comment_count,
    )
