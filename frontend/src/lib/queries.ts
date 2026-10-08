"use client";
// React Query hooks: one place for cache keys, fetching and cache invalidation after mutations.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "./api";
import type { MeetingFilters } from "./types";

export const keys = {
  me: ["me"] as const,
  stats: ["stats"] as const,
  channels: ["channels"] as const,
  participants: (role?: string) => ["participants", role ?? "all"] as const,
  meetings: (f: MeetingFilters) => ["meetings", f] as const,
  meeting: (id: number) => ["meeting", id] as const,
  transcript: (id: number) => ["transcript", id] as const,
  analytics: (id: number) => ["analytics", id] as const,
  comments: (id: number) => ["comments", id] as const,
  soundbites: (id: number) => ["soundbites", id] as const,
  bookmarks: (id: number) => ["bookmarks", id] as const,
  chat: (id: number) => ["chat", id] as const,
  suggestions: (id: number) => ["suggestions", id] as const,
  tasks: (mine: boolean) => ["tasks", mine] as const,
  trackers: ["trackers"] as const,
  search: (q: string) => ["search", q] as const,
};

export const errorToast = (e: unknown) => toast.error(e instanceof Error ? e.message : "Something went wrong");

// --- queries -----------------------------------------------------------------

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: api.me, staleTime: Infinity });
export const useStats = () => useQuery({ queryKey: keys.stats, queryFn: api.stats });
export const useChannels = () => useQuery({ queryKey: keys.channels, queryFn: api.channels });
export const useParticipants = (role?: "host" | "attendee") =>
  useQuery({ queryKey: keys.participants(role), queryFn: () => api.participants(role) });
export const useMeetings = (f: MeetingFilters) =>
  useQuery({ queryKey: keys.meetings(f), queryFn: () => api.meetings(f), placeholderData: (prev) => prev });
export const useMeeting = (id: number) => useQuery({ queryKey: keys.meeting(id), queryFn: () => api.meeting(id) });
export const useTranscript = (id: number) =>
  useQuery({ queryKey: keys.transcript(id), queryFn: () => api.transcript(id) });
export const useAnalytics = (id: number) => useQuery({ queryKey: keys.analytics(id), queryFn: () => api.analytics(id) });
export const useComments = (id: number) => useQuery({ queryKey: keys.comments(id), queryFn: () => api.comments(id) });
export const useSoundbites = (id: number) =>
  useQuery({ queryKey: keys.soundbites(id), queryFn: () => api.soundbites(id) });
export const useBookmarks = (id: number) => useQuery({ queryKey: keys.bookmarks(id), queryFn: () => api.bookmarks(id) });
export const useChat = (id: number) => useQuery({ queryKey: keys.chat(id), queryFn: () => api.chat(id) });
export const useChatSuggestions = (id: number) =>
  useQuery({ queryKey: keys.suggestions(id), queryFn: () => api.chatSuggestions(id) });
export const useTasks = (mine: boolean) => useQuery({ queryKey: keys.tasks(mine), queryFn: () => api.tasks({ mine }) });
export const useTrackers = () => useQuery({ queryKey: keys.trackers, queryFn: api.trackers });
export const useSearch = (q: string) =>
  useQuery({ queryKey: keys.search(q), queryFn: () => api.search(q), enabled: q.trim().length > 1 });

// --- mutations -----------------------------------------------------------------

/** Invalidate everything that lists or summarizes meetings. */
export function useInvalidateLibrary() {
  const qc = useQueryClient();
  return () =>
    Promise.all(
      [["meetings"], keys.stats, keys.channels, ["participants"], ["tasks"]].map((queryKey) =>
        qc.invalidateQueries({ queryKey }),
      ),
    );
}

/** Mutations scoped to one meeting refresh its detail + library views. */
export function useMeetingMutation<TArgs, TResult>(
  meetingId: number,
  fn: (args: TArgs) => Promise<TResult>,
  opts: { success?: string; extraKeys?: readonly (readonly unknown[])[] } = {},
) {
  const qc = useQueryClient();
  const invalidateLibrary = useInvalidateLibrary();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: keys.meeting(meetingId) }),
        ...(opts.extraKeys ?? []).map((queryKey) => qc.invalidateQueries({ queryKey })),
        invalidateLibrary(),
      ]);
      if (opts.success) toast.success(opts.success);
    },
    onError: errorToast,
  });
}
