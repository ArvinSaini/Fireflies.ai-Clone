"""ORM -> response schema mapping for shapes that aren't a 1:1 copy of a table."""
from app.models import Meeting
from app.schemas.common import ActionItemOut, ChannelOut, MeetingParticipantOut, ParticipantOut
from app.schemas.meeting import ChapterOut, MeetingDetail, MeetingListItem, SummaryOut


def participants_out(meeting: Meeting) -> list[MeetingParticipantOut]:
    out = [
        MeetingParticipantOut(**ParticipantOut.model_validate(link.participant).model_dump(), role=link.role)
        for link in meeting.participant_links
    ]
    return sorted(out, key=lambda p: (p.role != "host", p.name.lower()))


def channels_out(meeting: Meeting) -> list[ChannelOut]:
    return sorted((ChannelOut.model_validate(c) for c in meeting.channels), key=lambda c: c.name.lower())


def _common(meeting: Meeting) -> dict:
    host = meeting.host
    return dict(
        id=meeting.id, title=meeting.title, started_at=meeting.started_at, duration_ms=meeting.duration_ms,
        platform=meeting.platform, language=meeting.language, source_filename=meeting.source_filename,
        source_size_bytes=meeting.source_size_bytes, host=ParticipantOut.model_validate(host) if host else None,
        participants=participants_out(meeting), channels=channels_out(meeting),
    )


def meeting_list_item(meeting: Meeting, total_items: int, open_items: int) -> MeetingListItem:
    return MeetingListItem(
        **_common(meeting),
        overview=meeting.summary.overview if meeting.summary else None,
        action_items_total=total_items, action_items_open=open_items,
    )


def meeting_detail(meeting: Meeting, segment_count: int, comment_count: int) -> MeetingDetail:
    return MeetingDetail(
        **_common(meeting),
        description=meeting.description, media_url=meeting.media_url,
        created_at=meeting.created_at, updated_at=meeting.updated_at,
        summary=SummaryOut.model_validate(meeting.summary) if meeting.summary else None,
        chapters=[ChapterOut.model_validate(c) for c in meeting.chapters],
        action_items=[ActionItemOut.model_validate(a) for a in meeting.action_items],
        segment_count=segment_count, comment_count=comment_count,
    )
