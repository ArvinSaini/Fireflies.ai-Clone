"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUp, AudioLines, Bookmark, ChevronDown, ChevronUp, MessageSquare, Play, Plus, Search, Smile, Sparkles, Trash2, X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useComingSoon } from "@/components/providers/ComingSoonProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input, Skeleton, Textarea } from "@/components/ui/Primitives";
import { api } from "@/lib/api";
import { formatTimestamp } from "@/lib/format";
import { errorToast, keys, useAnalytics, useBookmarks, useComments, useMe, useSoundbites, useTrackers } from "@/lib/queries";
import type { FilterKey, Segment, SentimentKey } from "@/lib/types";
import { cn } from "@/lib/utils";
import { type RailPanel, useNotepad } from "./NotepadContext";
import { activeSegmentIndex, usePlayer } from "./PlayerContext";

const RAIL: { value: Exclude<RailPanel, null>; label: string; icon: React.ReactNode }[] = [
  { value: "search", label: "Smart Search", icon: <Search /> },
  { value: "soundbites", label: "Soundbites", icon: <AudioLines /> },
  { value: "comments", label: "Comments", icon: <MessageSquare /> },
  { value: "bookmarks", label: "Bookmarks", icon: <Bookmark /> },
];

export function LeftRail() {
  const { panel, setPanel } = useNotepad();
  const comingSoon = useComingSoon();
  return (
    <div className="hidden w-[60px] shrink-0 flex-col items-center gap-1 border-r border-line bg-surface py-3 sm:flex">
      {RAIL.map((r) => (
        <button key={r.value} onClick={() => setPanel(panel === r.value ? null : r.value)} title={r.label} aria-label={r.label}
          aria-pressed={panel === r.value}
          className={cn("flex size-10 items-center justify-center rounded-lg transition-colors [&_svg]:size-5 [&_svg]:stroke-[1.6]",
            panel === r.value ? "bg-brand-soft text-brand" : "text-ink-3 hover:bg-muted hover:text-ink")}>
          {r.icon}
        </button>
      ))}
      <button onClick={() => comingSoon("Reactions & feedback")} className="mt-auto flex size-10 items-center justify-center rounded-lg text-ink-4 hover:bg-muted" aria-label="Feedback">
        <Smile className="size-5" strokeWidth={1.6} />
      </button>
    </div>
  );
}

function PanelShell({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  const { setPanel } = useNotepad();
  return (
    <aside className="animate-fade-in flex w-full shrink-0 flex-col border-r border-line bg-surface sm:w-[340px]">
      <div className="flex h-14 items-center justify-between border-b border-line px-5">
        <h2 className="text-[15px] font-medium text-ink">{title}</h2>
        <div className="flex items-center gap-1">
          {action}
          <button onClick={() => setPanel(null)} aria-label="Close panel" className="rounded-md p-1 text-ink-4 hover:bg-muted"><X className="size-4" /></button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </aside>
  );
}

function Group({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="border-b border-line px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-medium tracking-wider text-ink-4 uppercase">{title}</h3>
        <div className="flex items-center gap-1">
          {action}
          <button onClick={() => setOpen(!open)} aria-label={open ? `Collapse ${title}` : `Expand ${title}`} className="rounded p-0.5 text-ink-4 hover:bg-muted">
            {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        </div>
      </div>
      {open && children}
    </section>
  );
}

const FILTERS: { key: FilterKey; label: string; color: string }[] = [
  { key: "metrics", label: "Metrics", color: "#2e90fa" },
  { key: "tasks", label: "Tasks", color: "#f79009" },
  { key: "questions", label: "Questions", color: "#ee46bc" },
  { key: "dates", label: "Date & Time", color: "#12b76a" },
];
const SENTIMENTS: { key: SentimentKey; label: string; color: string }[] = [
  { key: "positive", label: "Positive", color: "#2e90fa" },
  { key: "neutral", label: "Neutral", color: "#ee46bc" },
  { key: "negative", label: "Negative", color: "#f79009" },
];

function Ring({ percent, color }: { percent: number; color: string }) {
  const r = 8;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 20 20" className="size-5 -rotate-90" aria-hidden>
      <circle cx="10" cy="10" r={r} fill="none" stroke="var(--line)" strokeWidth="3" />
      <circle cx="10" cy="10" r={r} fill="none" stroke={color} strokeWidth="3" strokeDasharray={`${(percent / 100) * c} ${c}`} strokeLinecap="round" />
    </svg>
  );
}

export function SmartSearchPanel({ meetingId, segments }: { meetingId: number; segments: Segment[] }) {
  const qc = useQueryClient();
  const { data, isLoading } = useAnalytics(meetingId);
  const { data: trackers } = useTrackers();
  const { filter, setFilter, setRightTab } = useNotepad();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [words, setWords] = useState("");

  const addTracker = useMutation({
    mutationFn: () => api.addTracker({ name: name.trim(), keywords: words.split(",").map((w) => w.trim()).filter(Boolean) }),
    onSuccess: async () => {
      await Promise.all([qc.invalidateQueries({ queryKey: keys.trackers }), qc.invalidateQueries({ queryKey: ["analytics"] })]);
      toast.success(`Tracking "${name.trim()}" across all meetings`);
      setName(""); setWords(""); setAdding(false);
    },
    onError: errorToast,
  });
  const removeTracker = useMutation({
    mutationFn: (id: number) => api.deleteTracker(id),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: keys.trackers }), qc.invalidateQueries({ queryKey: ["analytics"] })]),
  });

  const apply = (label: string, color: string, ids: number[]) => {
    setRightTab("transcript");
    setFilter(filter?.label === label ? null : { label, color, segmentIds: ids });
  };
  const total = data ? Object.values(data.sentiments).reduce((a, v) => a + v.length, 0) || 1 : 1;

  return (
    <PanelShell title="Smart Search">
      {isLoading || !data ? (
        <div className="space-y-3 p-5">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : (
        <>
          <Group title="AI Filters">
            <div className="grid grid-cols-2 gap-2">
              {FILTERS.map((f) => {
                const ids = data.filters[f.key];
                const on = filter?.label === f.label;
                return (
                  <button key={f.key} onClick={() => apply(f.label, f.color, ids)} disabled={!ids.length}
                    className={cn("flex items-center gap-2 rounded-lg px-3 py-3 text-left text-[13px] transition-colors disabled:opacity-50",
                      on ? "bg-brand-soft text-brand-hover ring-1 ring-brand-200" : "bg-subtle text-ink-2 hover:bg-muted")}>
                    <span className="size-1.5 rounded-full" style={{ background: f.color }} />
                    <span className="flex-1">{f.label}</span>
                    <span className="text-ink-4">{ids.length}</span>
                  </button>
                );
              })}
            </div>
          </Group>
          <Group title="Sentiments">
            <div className="space-y-2">
              {SENTIMENTS.map((s) => {
                const ids = data.sentiments[s.key];
                const on = filter?.label === `${s.label} moments`;
                return (
                  <button key={s.key} onClick={() => apply(`${s.label} moments`, s.color, ids)} disabled={!ids.length}
                    className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-[13px]",
                      on ? "bg-brand-soft text-brand-hover ring-1 ring-brand-200" : "bg-subtle text-ink-2 hover:bg-muted")}>
                    <span className="size-1.5 rounded-full" style={{ background: s.color }} />
                    <span className="flex-1">{s.label}</span>
                    <span className="text-ink-4">{Math.round((ids.length / total) * 100)}%</span>
                  </button>
                );
              })}
            </div>
          </Group>
          <Group title="Speaker Talktime">
            <div className="mb-2 grid grid-cols-[1fr_56px_76px] text-[11px] font-medium tracking-wider text-ink-5 uppercase">
              <span>Speakers</span><span>WPM</span><span>Talktime</span>
            </div>
            <div className="space-y-1">
              {data.speakers.map((sp) => {
                const label = sp.participant?.name ?? "Unknown";
                const on = filter?.label === `lines by ${label}`;
                return (
                  <button key={label}
                    onClick={() => apply(`lines by ${label}`, sp.participant?.color ?? "#667085",
                      segments.filter((s) => (s.speaker?.id ?? null) === (sp.participant?.id ?? null)).map((s) => s.id))}
                    className={cn("grid w-full grid-cols-[1fr_56px_76px] items-center rounded-lg px-2 py-2 text-left text-[13px] hover:bg-muted", on && "bg-brand-soft")}
                    title={`${sp.word_count} words · ${sp.segment_count} turns`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Avatar name={label} color={sp.participant?.color} size="xs" />
                      <span className="truncate text-ink-2">{label}</span>
                    </span>
                    <span className="flex items-center gap-1 text-ink-3"><span className="size-1.5 rounded-full bg-[#f97066]" />{sp.words_per_minute}</span>
                    <span className="flex items-center gap-1.5 text-ink-3"><Ring percent={sp.talk_percent} color={sp.participant?.color ?? "var(--brand)"} />{Math.round(sp.talk_percent)}%</span>
                  </button>
                );
              })}
            </div>
          </Group>
          <Group title="Topic Trackers" action={
            <button onClick={() => setAdding(!adding)} aria-label="Add topic tracker" className="rounded p-0.5 text-ink-4 hover:bg-muted"><Plus className="size-4" /></button>
          }>
            {adding && (
              <form className="mb-3 space-y-2 rounded-lg border border-line p-3" onSubmit={(e) => { e.preventDefault(); if (name.trim() && words.trim()) addTracker.mutate(); }}>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tracker name, e.g. Pricing" className="h-9" />
                <Input value={words} onChange={(e) => setWords(e.target.value)} placeholder="Keywords: price, discount, budget" className="h-9" />
                <div className="flex justify-end gap-2">
                  <Button size="xs" onClick={() => setAdding(false)}>Cancel</Button>
                  <Button size="xs" variant="primary" type="submit" disabled={!name.trim() || !words.trim()}>Add tracker</Button>
                </div>
              </form>
            )}
            <div className="space-y-1">
              {data.topics.map((t) => {
                const on = filter?.label === `mentions of ${t.name}`;
                return (
                  <div key={t.tracker_id} className={cn("group flex items-center gap-2 rounded-lg px-2 py-2 text-[13px] hover:bg-muted", on && "bg-brand-soft")}>
                    <button className="flex flex-1 items-center gap-2 text-left disabled:opacity-50" disabled={!t.count}
                      onClick={() => apply(`mentions of ${t.name}`, t.color, t.segment_ids)}
                      title={trackers?.find((x) => x.id === t.tracker_id)?.keywords.join(", ")}>
                      <span className="size-1.5 rounded-full" style={{ background: t.color }} />
                      <span className="flex-1 text-ink-2">{t.name}</span>
                      <span className="text-ink-4">{t.count}</span>
                    </button>
                    <button onClick={() => removeTracker.mutate(t.tracker_id)} aria-label={`Delete ${t.name} tracker`} className="hidden rounded p-0.5 text-ink-5 group-hover:block hover:text-danger">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                );
              })}
              {!data.topics.length && !adding && <p className="text-[13px] text-ink-5">Track keywords like competitors or pricing across every meeting.</p>}
            </div>
          </Group>
        </>
      )}
    </PanelShell>
  );
}

export function SoundbitesPanel({ meetingId, segments }: { meetingId: number; segments: Segment[] }) {
  const qc = useQueryClient();
  const comingSoon = useComingSoon();
  const { currentMs, seek } = usePlayer();
  const { data: bites, isLoading } = useSoundbites(meetingId);
  const starts = useMemo(() => segments.map((s) => s.start_ms), [segments]);

  const invalidate = () => qc.invalidateQueries({ queryKey: keys.soundbites(meetingId) });
  const create = useMutation({
    mutationFn: () => {
      const seg = segments[Math.max(0, activeSegmentIndex(starts, currentMs))]!;
      return api.addSoundbite(meetingId, {
        title: seg.text.split(/(?<=[.!?])\s/)[0]!.slice(0, 80), start_ms: seg.start_ms, end_ms: Math.max(seg.end_ms, seg.start_ms + 3000), segment_id: seg.id,
      });
    },
    onSuccess: () => { invalidate(); toast.success("Soundbite created from the current moment"); },
    onError: errorToast,
  });
  const remove = useMutation({ mutationFn: (id: number) => api.deleteSoundbite(id), onSuccess: invalidate });

  return (
    <PanelShell title={`Soundbite${bites?.length ? ` · ${bites.length}` : ""}`} action={
      <button onClick={() => create.mutate()} disabled={!segments.length} aria-label="Create soundbite" className="rounded-md p-1 text-ink-4 hover:bg-muted"><Plus className="size-4" /></button>
    }>
      {isLoading ? <div className="p-5"><Skeleton className="h-16" /></div> : bites?.length ? (
        <ul className="space-y-2 p-4">
          {bites.map((b) => (
            <li key={b.id} className="group flex items-start gap-3 rounded-xl border border-line p-3 hover:bg-subtle">
              <button onClick={() => seek(b.start_ms, { play: true })} aria-label={`Play ${b.title}`}
                className="relative flex h-12 w-20 shrink-0 items-center justify-center rounded-lg bg-[#1b1440] text-white hover:opacity-90">
                <Play className="size-4 fill-current" />
                <span className="absolute right-1 bottom-1 rounded bg-white px-1 text-[10px] font-medium text-[#101828]">
                  {formatTimestamp(b.end_ms - b.start_ms)}
                </span>
              </button>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[13px] text-ink">{b.title}</p>
                <p className="mt-0.5 text-xs text-ink-4">{formatTimestamp(b.start_ms)} – {formatTimestamp(b.end_ms)}</p>
              </div>
              <button onClick={() => remove.mutate(b.id)} aria-label="Delete soundbite" className="rounded p-1 text-ink-5 opacity-0 group-hover:opacity-100 hover:text-danger"><Trash2 className="size-4" /></button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="m-4 rounded-xl border border-line p-6 text-center">
          <p className="text-[15px] font-medium text-ink">Clip out important moments</p>
          <p className="mt-1 text-[13px] text-ink-4">Pick a moment in your transcript or let Fireflies AI create it for you.</p>
          <Button variant="primary" className="mt-5 w-full" onClick={() => create.mutate()} disabled={!segments.length}>
            <AudioLines className="size-4" /> Create Soundbite
          </Button>
          <Button variant="soft" className="mt-2 w-full" onClick={() => comingSoon("AI Soundbites")}>
            <Sparkles className="size-4" /> AI Soundbite
          </Button>
        </div>
      )}
    </PanelShell>
  );
}

export function CommentsPanel({ meetingId, segments }: { meetingId: number; segments: Segment[] }) {
  const qc = useQueryClient();
  const { data: comments } = useComments(meetingId);
  const { data: me } = useMe();
  const { commentOn, setCommentOn, setFocusSegment } = useNotepad();
  const { currentMs, seek } = usePlayer();
  const [body, setBody] = useState("");
  const starts = useMemo(() => segments.map((s) => s.start_ms), [segments]);
  // Comments attach to the line chosen via the transcript toolbar, else the line playing now.
  const target = segments.find((s) => s.id === commentOn) ?? segments[Math.max(0, activeSegmentIndex(starts, currentMs))];
  const segById = useMemo(() => new Map(segments.map((s) => [s.id, s])), [segments]);

  const invalidate = () => Promise.all([qc.invalidateQueries({ queryKey: keys.comments(meetingId) }), qc.invalidateQueries({ queryKey: keys.meeting(meetingId) })]);
  const add = useMutation({
    mutationFn: () => api.addComment(meetingId, { segment_id: target!.id, body: body.trim() }),
    onSuccess: () => { invalidate(); setBody(""); setCommentOn(null); toast.success("Comment added"); },
    onError: errorToast,
  });
  const remove = useMutation({ mutationFn: (id: number) => api.deleteComment(id), onSuccess: invalidate });

  return (
    <PanelShell title="All comments">
      <div className="flex h-full flex-col">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {comments?.map((c) => {
            const seg = segById.get(c.segment_id);
            return (
              <div key={c.id} className="group rounded-xl border border-line p-3">
                <div className="flex items-center gap-2">
                  <Avatar name={c.author.name} color={c.author.avatar_color} size="sm" />
                  <span className="text-[13px] font-medium text-ink">{c.author.name}</span>
                  {seg && (
                    <button onClick={() => { seek(seg.start_ms); setFocusSegment(seg.id); }} className="text-xs text-link underline">{formatTimestamp(seg.start_ms)}</button>
                  )}
                  <button onClick={() => remove.mutate(c.id)} aria-label="Delete comment" className="ml-auto rounded p-0.5 text-ink-5 opacity-0 group-hover:opacity-100 hover:text-danger"><Trash2 className="size-3.5" /></button>
                </div>
                <p className="mt-2 text-[13px] text-ink-2">{c.body}</p>
              </div>
            );
          })}
          {!comments?.length && (
            <div className="px-2 py-16 text-center">
              <p className="text-[15px] font-medium text-ink">No discussion started yet</p>
              <p className="mt-1 text-[13px] text-ink-4">Start a thread on any moment — hover a transcript line and click 💬, or comment below.</p>
            </div>
          )}
        </div>
        {target && (
          <form className="border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); if (body.trim()) add.mutate(); }}>
            <p className="mb-2 line-clamp-1 text-xs text-ink-4">
              On <span className="text-link">{formatTimestamp(target.start_ms)}</span> · {target.speaker?.name}: “{target.text}”
            </p>
            <div className="flex items-end gap-2">
              <Avatar name={me?.name ?? "?"} color={me?.avatar_color} size="md" />
              <Textarea autoFocus={!!commentOn} rows={1} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Comment…" className="min-h-9" />
              <Button size="sm" variant="primary" type="submit" aria-label="Comment" className="w-9 px-0" disabled={!body.trim()}>
                <ArrowUp className="size-4" />
              </Button>
            </div>
          </form>
        )}
      </div>
    </PanelShell>
  );
}

export function BookmarksPanel({ meetingId, segments }: { meetingId: number; segments: Segment[] }) {
  const qc = useQueryClient();
  const { data: bookmarks } = useBookmarks(meetingId);
  const { setFocusSegment } = useNotepad();
  const { seek } = usePlayer();
  const segById = useMemo(() => new Map(segments.map((s) => [s.id, s])), [segments]);
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteBookmark(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.bookmarks(meetingId) }),
  });
  return (
    <PanelShell title="All Bookmarks">
      <div className="space-y-2 p-4">
        {bookmarks?.map((b) => {
          const seg = segById.get(b.segment_id);
          if (!seg) return null;
          return (
            <div key={b.id} className="group flex gap-3 rounded-xl border border-line p-3 hover:bg-subtle">
              <Bookmark className="mt-0.5 size-4 shrink-0 fill-brand text-brand" />
              <button className="min-w-0 flex-1 text-left" onClick={() => { seek(seg.start_ms, { play: true }); setFocusSegment(seg.id); }}>
                <p className="text-xs text-ink-4"><span className="text-link">{formatTimestamp(seg.start_ms)}</span> · {seg.speaker?.name}</p>
                <p className="mt-1 line-clamp-3 text-[13px] text-ink-2">{seg.text}</p>
              </button>
              <button onClick={() => remove.mutate(b.id)} aria-label="Remove bookmark" className="self-start rounded p-0.5 text-ink-5 opacity-0 group-hover:opacity-100 hover:text-danger"><X className="size-4" /></button>
            </div>
          );
        })}
        {!bookmarks?.length && (
          <div className="px-4 py-16 text-center">
            <p className="text-[15px] font-medium text-ink">No bookmarks yet</p>
            <p className="mt-1 text-[13px] text-ink-4">Add bookmarks to highlight key moments in the meeting. Hover a transcript line and click 🔖.</p>
          </div>
        )}
      </div>
    </PanelShell>
  );
}
