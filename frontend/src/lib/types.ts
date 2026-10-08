// Mirrors the FastAPI response/request schemas (backend/app/schemas).

export type Platform = "zoom" | "google_meet" | "teams" | "upload" | "paste" | "manual";

export interface Participant {
  id: number;
  name: string;
  email: string | null;
  color: string;
}

export interface MeetingParticipant extends Participant {
  role: "host" | "attendee";
}

export interface ParticipantCount extends Participant {
  meeting_count: number;
}

export interface Channel {
  id: number;
  name: string;
  description: string | null;
  is_private: boolean;
  color: string;
}

export interface ChannelCount extends Channel {
  meeting_count: number;
}

export interface Me {
  id: number;
  name: string;
  email: string;
  avatar_color: string;
  participant: Participant | null;
}

export interface WorkspaceStats {
  meeting_count: number;
  total_duration_ms: number;
  meetings_this_week: number;
  action_items_total: number;
  action_items_open: number;
  participant_count: number;
  ai_engine: "llm" | "heuristic";
}

export interface ActionItem {
  id: number;
  meeting_id: number;
  text: string;
  is_completed: boolean;
  completed_at: string | null;
  due_date: string | null;
  timestamp_ms: number | null;
  segment_id: number | null;
  source: "ai" | "user";
  position: number;
  assignee: Participant | null;
  created_at: string;
}

export interface ActionItemWithMeeting extends ActionItem {
  meeting_title: string;
  meeting_started_at: string;
}

export interface NoteSection {
  heading: string;
  start_ms: number | null;
  bullets: string[];
}

export interface Summary {
  overview: string;
  keywords: string[];
  notes: NoteSection[];
  generated_by: "seed" | "heuristic" | "llm" | "user";
  updated_at: string;
}

export interface Chapter {
  id: number;
  title: string;
  description: string;
  start_ms: number;
  end_ms: number;
}

interface MeetingBase {
  id: number;
  title: string;
  started_at: string;
  duration_ms: number;
  platform: Platform;
  language: string;
  source_filename: string | null;
  source_size_bytes: number | null;
  host: Participant | null;
  participants: MeetingParticipant[];
  channels: Channel[];
}

export interface MeetingListItem extends MeetingBase {
  overview: string | null;
  action_items_total: number;
  action_items_open: number;
}

export interface MeetingDetail extends MeetingBase {
  description: string | null;
  media_url: string | null;
  created_at: string;
  updated_at: string;
  summary: Summary | null;
  chapters: Chapter[];
  action_items: ActionItem[];
  segment_count: number;
  comment_count: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface Segment {
  id: number;
  position: number;
  start_ms: number;
  end_ms: number;
  text: string;
  speaker: Participant | null;
}

export interface SpeakerStat {
  participant: Participant | null;
  talk_ms: number;
  talk_percent: number;
  segment_count: number;
  word_count: number;
  words_per_minute: number;
}

export interface TopicHit {
  tracker_id: number;
  name: string;
  color: string;
  count: number;
  segment_ids: number[];
}

export type FilterKey = "questions" | "dates" | "metrics" | "tasks";
export type SentimentKey = "positive" | "neutral" | "negative";

export interface MeetingAnalytics {
  speakers: SpeakerStat[];
  filters: Record<FilterKey, number[]>;
  sentiments: Record<SentimentKey, number[]>;
  topics: TopicHit[];
  total_words: number;
  question_count: number;
}

export interface TopicTracker {
  id: number;
  name: string;
  keywords: string[];
  color: string;
}

export interface Comment {
  id: number;
  meeting_id: number;
  segment_id: number;
  body: string;
  created_at: string;
  author: { id: number; name: string; email: string; avatar_color: string };
}

export interface Soundbite {
  id: number;
  meeting_id: number;
  segment_id: number | null;
  title: string;
  start_ms: number;
  end_ms: number;
  created_at: string;
}

export interface Bookmark {
  id: number;
  meeting_id: number;
  segment_id: number;
  created_at: string;
}

export interface ChatCitation {
  segment_id: number;
  start_ms: number;
  speaker: string | null;
  text: string;
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  citations: ChatCitation[];
  created_at: string;
}

export interface SearchHit {
  meeting_id: number;
  meeting_title: string;
  meeting_started_at: string;
  segment_id: number | null;
  start_ms: number | null;
  speaker: string | null;
  snippet: string; // contains <mark> tags (server-escaped)
  kind: "title" | "transcript";
}

export interface SearchResults {
  query: string;
  total: number;
  hits: SearchHit[];
}

// --- requests ---------------------------------------------------------------

export interface ParticipantInput {
  name: string;
  email?: string | null;
}

export interface MeetingCreateInput {
  title: string;
  started_at?: string | null;
  platform?: Platform;
  language?: string;
  participants?: ParticipantInput[];
  channel_ids?: number[];
  transcript_text?: string | null;
  duration_minutes?: number | null;
  generate_summary?: boolean;
}

export interface MeetingUpdateInput {
  title?: string;
  started_at?: string;
  language?: string;
  participants?: ParticipantInput[];
  channel_ids?: number[];
}

export interface MeetingFilters {
  q?: string;
  scope?: "all" | "mine" | "shared";
  host_id?: number[];
  participant_id?: number[];
  channel_id?: number[];
  platform?: string[];
  date_from?: string;
  date_to?: string;
  min_duration?: number;
  max_duration?: number;
  sort?: "recent" | "oldest" | "longest" | "shortest" | "title";
  page?: number;
  page_size?: number;
}

export interface WorkspaceCitation extends ChatCitation {
  meeting_id: number;
  meeting_title: string;
}

export interface WorkspaceAnswer {
  answer: string;
  citations: WorkspaceCitation[];
  meetings: { meeting_id: number; meeting_title: string; started_at: string }[];
}
