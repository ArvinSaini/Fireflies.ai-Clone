// Thin typed client for the FastAPI backend. All network access goes through here.
import type {
  ActionItem, ActionItemWithMeeting, Bookmark, ChannelCount, Channel, ChatMessage, Comment, Me, MeetingAnalytics,
  MeetingCreateInput, MeetingDetail, MeetingFilters, MeetingListItem, MeetingUpdateInput, Page, ParticipantCount,
  SearchResults, Segment, Soundbite, Summary, NoteSection, TopicTracker, WorkspaceStats,
} from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | undefined | null | (string | number)[]>;

function toQuery(params?: Query): string {
  if (!params) return "";
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) value.forEach((v) => qs.append(key, String(v)));
    else qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

async function request<T>(path: string, init?: RequestInit & { query?: Query }): Promise<T> {
  const { query, ...rest } = init ?? {};
  const isForm = rest.body instanceof FormData;
  const res = await fetch(`${API_URL}/api${path}${toQuery(query)}`, {
    ...rest,
    headers: isForm ? rest.headers : { "Content-Type": "application/json", ...rest.headers },
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = typeof body.detail === "string" ? body.detail : body.detail?.[0]?.msg ?? message;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

const json = (body: unknown) => JSON.stringify(body);

export const api = {
  // workspace
  me: () => request<Me>("/me"),
  stats: () => request<WorkspaceStats>("/stats"),
  participants: (role?: "host" | "attendee") => request<ParticipantCount[]>("/participants", { query: { role } }),
  search: (q: string) => request<SearchResults>("/search", { query: { q, limit: 30 } }),

  // channels
  channels: () => request<ChannelCount[]>("/channels"),
  createChannel: (data: { name: string; description?: string; is_private?: boolean }) =>
    request<Channel>("/channels", { method: "POST", body: json(data) }),
  deleteChannel: (id: number) => request<void>(`/channels/${id}`, { method: "DELETE" }),

  // meetings
  meetings: (filters: MeetingFilters) => request<Page<MeetingListItem>>("/meetings", { query: filters as Query }),
  meeting: (id: number) => request<MeetingDetail>(`/meetings/${id}`),
  createMeeting: (data: MeetingCreateInput) => request<MeetingDetail>("/meetings", { method: "POST", body: json(data) }),
  uploadMeeting: (form: FormData) => request<MeetingDetail>("/meetings/upload", { method: "POST", body: form }),
  updateMeeting: (id: number, data: MeetingUpdateInput) =>
    request<MeetingDetail>(`/meetings/${id}`, { method: "PATCH", body: json(data) }),
  deleteMeeting: (id: number) => request<void>(`/meetings/${id}`, { method: "DELETE" }),
  bulk: (data: { action: "delete" | "move"; meeting_ids: number[]; channel_ids?: number[] }) =>
    request<{ affected: number }>("/meetings/bulk", { method: "POST", body: json(data) }),
  transcript: (id: number) => request<Segment[]>(`/meetings/${id}/transcript`),
  analytics: (id: number) => request<MeetingAnalytics>(`/meetings/${id}/analytics`),
  regenerate: (id: number) => request<MeetingDetail>(`/meetings/${id}/summary/regenerate`, { method: "POST" }),
  updateSummary: (id: number, data: { overview?: string; keywords?: string[]; notes?: NoteSection[] }) =>
    request<Summary>(`/meetings/${id}/summary`, { method: "PATCH", body: json(data) }),
  exportUrl: (id: number, format: "md" | "txt" | "json") => `${API_URL}/api/meetings/${id}/export?format=${format}`,

  // transcript
  updateSegment: (id: number, data: { text?: string; speaker_name?: string }) =>
    request<Segment>(`/segments/${id}`, { method: "PATCH", body: json(data) }),
  comments: (meetingId: number) => request<Comment[]>(`/meetings/${meetingId}/comments`),
  addComment: (meetingId: number, data: { segment_id: number; body: string }) =>
    request<Comment>(`/meetings/${meetingId}/comments`, { method: "POST", body: json(data) }),
  deleteComment: (id: number) => request<void>(`/comments/${id}`, { method: "DELETE" }),
  soundbites: (meetingId: number) => request<Soundbite[]>(`/meetings/${meetingId}/soundbites`),
  addSoundbite: (meetingId: number, data: { title: string; start_ms: number; end_ms: number; segment_id?: number }) =>
    request<Soundbite>(`/meetings/${meetingId}/soundbites`, { method: "POST", body: json(data) }),
  deleteSoundbite: (id: number) => request<void>(`/soundbites/${id}`, { method: "DELETE" }),
  bookmarks: (meetingId: number) => request<Bookmark[]>(`/meetings/${meetingId}/bookmarks`),
  addBookmark: (meetingId: number, segmentId: number) =>
    request<Bookmark>(`/meetings/${meetingId}/bookmarks`, { method: "POST", body: json({ segment_id: segmentId }) }),
  deleteBookmark: (id: number) => request<void>(`/bookmarks/${id}`, { method: "DELETE" }),

  // action items
  tasks: (params: { mine?: boolean; status_filter?: "all" | "open" | "completed" }) =>
    request<ActionItemWithMeeting[]>("/action-items", { query: params }),
  addActionItem: (meetingId: number, data: { text: string; assignee_id?: number | null; segment_id?: number }) =>
    request<ActionItem>(`/meetings/${meetingId}/action-items`, { method: "POST", body: json(data) }),
  updateActionItem: (id: number, data: Partial<Pick<ActionItem, "text" | "is_completed" | "due_date">> & { assignee_id?: number | null }) =>
    request<ActionItem>(`/action-items/${id}`, { method: "PATCH", body: json(data) }),
  deleteActionItem: (id: number) => request<void>(`/action-items/${id}`, { method: "DELETE" }),

  // AskFred
  chat: (meetingId: number) => request<ChatMessage[]>(`/meetings/${meetingId}/chat`),
  chatSuggestions: (meetingId: number) => request<string[]>(`/meetings/${meetingId}/chat/suggestions`),
  ask: (meetingId: number, question: string) =>
    request<ChatMessage[]>(`/meetings/${meetingId}/chat`, { method: "POST", body: json({ question }) }),
  clearChat: (meetingId: number) => request<void>(`/meetings/${meetingId}/chat`, { method: "DELETE" }),

  // topic trackers
  trackers: () => request<TopicTracker[]>("/topic-trackers"),
  addTracker: (data: { name: string; keywords: string[] }) =>
    request<TopicTracker>("/topic-trackers", { method: "POST", body: json(data) }),
  deleteTracker: (id: number) => request<void>(`/topic-trackers/${id}`, { method: "DELETE" }),
};
