"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  AudioLines, Bookmark, BookmarkCheck, ChevronDown, ChevronUp, Copy, Link2, MessageSquare, Search, X,
} from "lucide-react";
import { memo, useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/Avatar";
import { MenuItem, Popover } from "@/components/ui/Popover";
import { api } from "@/lib/api";
import { formatTimestamp } from "@/lib/format";
import { errorToast, keys, useBookmarks, useComments } from "@/lib/queries";
import type { Comment, Participant, Segment } from "@/lib/types";
import { cn, countMatches, splitMatches } from "@/lib/utils";
import { useNotepad } from "./NotepadContext";
import { activeSegmentIndex, usePlayer } from "./PlayerContext";

interface LineProps {
  seg: Segment;
  active: boolean;
  query: string;
  currentMatch: number | null; // index of the "current" match within this line, if any
  editing: boolean;
  bookmarked: boolean;
  comments: Comment[];
  speakers: Participant[];
  onSeek: (seg: Segment) => void;
  onSave: (seg: Segment, text: string) => void;
  onSpeaker: (seg: Segment, name: string) => void;
  onBookmark: (seg: Segment) => void;
  onSoundbite: (seg: Segment) => void;
  onComment: (seg: Segment) => void;
}

/** One transcript block. Memoized: only the active/matching lines re-render while playing. */
const Line = memo(function Line({
  seg, active, query, currentMatch, editing, bookmarked, comments, speakers,
  onSeek, onSave, onSpeaker, onBookmark, onSoundbite, onComment,
}: LineProps) {
  const name = seg.speaker?.name ?? "Unknown speaker";
  // Number each match so the "current" one (find → next/prev) can be styled.
  const parts = splitMatches(seg.text, query);
  const matchOrder = parts.map((_, i) => parts.slice(0, i + 1).filter((p) => p.match).length - 1);
  return (
    <div data-segment={seg.id} className="group relative py-3">
      <div className="flex items-center gap-1.5 text-[14px]">
        <Avatar name={name} color={seg.speaker?.color} size="sm" />
        <Popover
          className="w-52"
          trigger={({ toggle }) => (
            <button onClick={toggle} className="ml-1 inline-flex items-center gap-0.5 font-medium text-ink hover:text-brand" title="Change speaker">
              {name} <ChevronDown className="size-3.5 text-ink-4" />
            </button>
          )}
        >
          {(close) => (
            <>
              <p className="px-2.5 pt-1.5 pb-1 text-xs text-ink-4">Re-assign this line to</p>
              {speakers.filter((s) => s.id !== seg.speaker?.id).map((s) => (
                <MenuItem key={s.id} icon={<Avatar name={s.name} color={s.color} size="xs" />} onClick={() => { close(); onSpeaker(seg, s.name); }}>
                  {s.name}
                </MenuItem>
              ))}
            </>
          )}
        </Popover>
        <span className="text-ink-5">·</span>
        <button onClick={() => onSeek(seg)} className="text-link underline decoration-1 underline-offset-2 hover:opacity-80">
          {formatTimestamp(seg.start_ms)}
        </button>
        {bookmarked && <BookmarkCheck className="ml-1 size-3.5 text-brand" aria-label="Bookmarked" />}
        {comments.length > 0 && (
          <span className="ml-1 inline-flex items-center gap-0.5 text-xs text-ink-4"><MessageSquare className="size-3.5" />{comments.length}</span>
        )}
      </div>

      {editing ? (
        <textarea
          defaultValue={seg.text}
          rows={Math.max(2, Math.ceil(seg.text.length / 60))}
          onBlur={(e) => e.target.value.trim() !== seg.text && onSave(seg, e.target.value.trim())}
          className="mt-1.5 ml-8 w-[calc(100%-2rem)] resize-y rounded-lg border border-line-strong bg-surface p-2 text-[15px] leading-relaxed text-ink-2 outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
        />
      ) : (
        <p
          onClick={() => onSeek(seg)}
          className={cn(
            "mt-1.5 ml-7 cursor-pointer rounded-md px-1 text-[15px] leading-[1.7] text-ink-2 transition-colors",
            active ? "bg-active-line text-ink" : "hover:bg-subtle",
          )}
        >
          {parts.map((part, i) =>
            part.match ? (
              <mark key={i} className={cn(matchOrder[i] === currentMatch && "current")}>{part.text}</mark>
            ) : (
              <span key={i}>{part.text}</span>
            ),
          )}
        </p>
      )}

      {comments.map((c) => (
        <div key={c.id} className="mt-2 ml-8 flex gap-2 rounded-lg border border-line bg-subtle px-3 py-2 text-[13px]">
          <Avatar name={c.author.name} color={c.author.avatar_color} size="xs" className="mt-0.5" />
          <span className="text-ink-2"><b className="font-medium text-ink">{c.author.name}</b> {c.body}</span>
        </div>
      ))}

      {!editing && (
        <div className="absolute -top-2 right-0 z-10 hidden items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5 shadow-pop group-hover:flex">
          <button onClick={() => onSoundbite(seg)} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] text-brand hover:bg-brand-soft">
            <AudioLines className="size-4" /> Create Soundbite
          </button>
          <IconAction label="Comment" onClick={() => onComment(seg)}><MessageSquare /></IconAction>
          <IconAction label={bookmarked ? "Remove bookmark" : "Bookmark"} onClick={() => onBookmark(seg)}>
            {bookmarked ? <BookmarkCheck className="text-brand" /> : <Bookmark />}
          </IconAction>
          <IconAction label="Copy text" onClick={() => { void navigator.clipboard?.writeText(seg.text); toast.success("Copied to clipboard"); }}><Copy /></IconAction>
          <IconAction label="Copy link to this moment" onClick={() => {
            void navigator.clipboard?.writeText(`${window.location.origin}${window.location.pathname}?t=${seg.start_ms}`);
            toast.success("Link to this moment copied");
          }}><Link2 /></IconAction>
        </div>
      )}
    </div>
  );
});

function IconAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className="rounded-md p-1.5 text-ink-4 hover:bg-muted hover:text-ink [&_svg]:size-4">
      {children}
    </button>
  );
}

export function TranscriptPanel({ segments, editing }: { segments: Segment[]; editing: boolean }) {
  const qc = useQueryClient();
  const { meetingId, filter, setFilter, focusSegment, setFocusSegment, setCommentOn, setPanel } = useNotepad();
  const { currentMs, playing, seek } = usePlayer();
  const { data: bookmarks } = useBookmarks(meetingId);
  const { data: comments } = useComments(meetingId);
  const scroller = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [current, setCurrent] = useState(0);
  const [follow, setFollow] = useState(true);
  const programmaticScroll = useRef(false);

  const starts = useMemo(() => segments.map((s) => s.start_ms), [segments]);
  const activeIdx = activeSegmentIndex(starts, currentMs);
  const activeId = activeIdx >= 0 && currentMs > 0 ? segments[activeIdx]!.id : null;

  const speakers = useMemo(() => {
    const map = new Map<number, Participant>();
    segments.forEach((s) => s.speaker && map.set(s.speaker.id, s.speaker));
    return [...map.values()];
  }, [segments]);

  const visible = useMemo(
    () => (filter ? segments.filter((s) => filter.segmentIds.includes(s.id)) : segments),
    [segments, filter],
  );

  // Find: count matches per visible line so "3 / 12" navigation can point at a specific <mark>.
  const matchPlan = useMemo(() => {
    const plan: { segId: number; count: number }[] = [];
    if (query.trim()) visible.forEach((s) => { const n = countMatches(s.text, query); if (n) plan.push({ segId: s.id, count: n }); });
    return plan;
  }, [visible, query]);
  const totalMatches = matchPlan.reduce((a, p) => a + p.count, 0);
  // Restart at the first match whenever the query or filter changes (reset during render, not in an effect).
  const findKey = `${query}|${filter?.label ?? ""}`;
  const [prevFindKey, setPrevFindKey] = useState(findKey);
  if (prevFindKey !== findKey) {
    setPrevFindKey(findKey);
    setCurrent(0);
  }

  const locate = (n: number): { segId: number; local: number } | null => {
    let acc = 0;
    for (const p of matchPlan) {
      if (n < acc + p.count) return { segId: p.segId, local: n - acc };
      acc += p.count;
    }
    return null;
  };
  const currentLoc = totalMatches ? locate(current) : null;

  const scrollToSegment = useCallback((id: number, smooth = true) => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-segment="${id}"]`);
    if (!el || !scroller.current) return;
    programmaticScroll.current = true;
    scroller.current.scrollTo({ top: el.offsetTop - scroller.current.clientHeight / 3, behavior: smooth ? "smooth" : "auto" });
    window.setTimeout(() => (programmaticScroll.current = false), 600);
  }, []);

  // Player → transcript: keep the active line in view while following.
  useEffect(() => {
    if (activeId && follow && !query) scrollToSegment(activeId);
  }, [activeId, follow, query, scrollToSegment]);

  // Find navigation → scroll to the current match (only when the match index/count changes).
  const scrollToCurrentMatch = useEffectEvent(() => currentLoc && scrollToSegment(currentLoc.segId));
  useEffect(() => {
    scrollToCurrentMatch();
  }, [current, totalMatches]);

  // External requests (comments / bookmarks / AskFred citations).
  useEffect(() => {
    if (focusSegment == null) return;
    setFilter(null);
    window.setTimeout(() => scrollToSegment(focusSegment), 50);
    setFocusSegment(null);
  }, [focusSegment, scrollToSegment, setFilter, setFocusSegment]);

  // A manual scroll while playing stops following, revealing "Sync with audio".
  const onScroll = () => {
    if (!programmaticScroll.current && playing) setFollow(false);
  };

  const bookmarkBySeg = useMemo(() => new Map((bookmarks ?? []).map((b) => [b.segment_id, b])), [bookmarks]);
  const commentsBySeg = useMemo(() => {
    const map = new Map<number, Comment[]>();
    (comments ?? []).forEach((c) => map.set(c.segment_id, [...(map.get(c.segment_id) ?? []), c]));
    return map;
  }, [comments]);

  const onSeek = useCallback((seg: Segment) => { setFollow(true); seek(seg.start_ms, { play: true }); }, [seek]);
  const onSave = useCallback(async (seg: Segment, text: string) => {
    try {
      await api.updateSegment(seg.id, { text });
      await qc.invalidateQueries({ queryKey: keys.transcript(meetingId) });
      toast.success("Transcript updated");
    } catch (e) { errorToast(e); }
  }, [qc, meetingId]);
  const onSpeaker = useCallback(async (seg: Segment, name: string) => {
    try {
      await api.updateSegment(seg.id, { speaker_name: name });
      await Promise.all([keys.transcript(meetingId), keys.analytics(meetingId)].map((k) => qc.invalidateQueries({ queryKey: k })));
      toast.success(`Line re-assigned to ${name}`);
    } catch (e) { errorToast(e); }
  }, [qc, meetingId]);
  const onBookmark = useCallback(async (seg: Segment) => {
    try {
      const existing = bookmarkBySeg.get(seg.id);
      if (existing) await api.deleteBookmark(existing.id);
      else await api.addBookmark(meetingId, seg.id);
      await qc.invalidateQueries({ queryKey: keys.bookmarks(meetingId) });
      toast.success(existing ? "Bookmark removed" : "Moment bookmarked");
    } catch (e) { errorToast(e); }
  }, [bookmarkBySeg, meetingId, qc]);
  const onSoundbite = useCallback(async (seg: Segment) => {
    try {
      const title = seg.text.split(/(?<=[.!?])\s/)[0]!.slice(0, 80);
      await api.addSoundbite(meetingId, { title, start_ms: seg.start_ms, end_ms: Math.max(seg.end_ms, seg.start_ms + 3000), segment_id: seg.id });
      await qc.invalidateQueries({ queryKey: keys.soundbites(meetingId) });
      toast.success("Soundbite created", { description: title });
    } catch (e) { errorToast(e); }
  }, [meetingId, qc]);
  const onComment = useCallback((seg: Segment) => { setCommentOn(seg.id); setPanel("comments"); }, [setCommentOn, setPanel]);

  const step = (d: number) => totalMatches && setCurrent((c) => (c + d + totalMatches) % totalMatches);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pt-3 pb-2">
        <div className="flex h-10 items-center gap-2 rounded-lg bg-subtle px-3">
          <Search className="size-4 text-ink-5" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); step(e.shiftKey ? -1 : 1); } }}
            placeholder="Find in transcript"
            aria-label="Find in transcript"
            className="h-full flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-5"
          />
          {query && (
            <>
              <span className="text-xs whitespace-nowrap text-ink-4">{totalMatches ? `${current + 1} / ${totalMatches}` : "No results"}</span>
              <button aria-label="Previous match" onClick={() => step(-1)} className="rounded p-0.5 text-ink-4 hover:bg-muted"><ChevronUp className="size-4" /></button>
              <button aria-label="Next match" onClick={() => step(1)} className="rounded p-0.5 text-ink-4 hover:bg-muted"><ChevronDown className="size-4" /></button>
              <button aria-label="Clear search" onClick={() => setQuery("")} className="rounded p-0.5 text-ink-4 hover:bg-muted"><X className="size-4" /></button>
            </>
          )}
        </div>
        {filter && (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-brand-soft px-3 py-1.5 text-[13px] text-brand-hover">
            <span className="size-2 rounded-full" style={{ background: filter.color }} />
            Showing {filter.segmentIds.length} {filter.label}
            <button onClick={() => setFilter(null)} className="ml-auto inline-flex items-center gap-1 text-xs font-medium hover:underline">
              Clear <X className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      <div ref={scroller} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto px-5 pb-16">
        {visible.map((seg) => (
          <Line
            key={seg.id}
            seg={seg}
            active={seg.id === activeId}
            query={query}
            currentMatch={currentLoc?.segId === seg.id ? currentLoc.local : null}
            editing={editing}
            bookmarked={bookmarkBySeg.has(seg.id)}
            comments={commentsBySeg.get(seg.id) ?? []}
            speakers={speakers}
            onSeek={onSeek}
            onSave={onSave}
            onSpeaker={onSpeaker}
            onBookmark={onBookmark}
            onSoundbite={onSoundbite}
            onComment={onComment}
          />
        ))}
        {!visible.length && <p className="py-16 text-center text-[13px] text-ink-4">No transcript lines to show.</p>}
      </div>

      {!follow && activeId && (
        <button
          onClick={() => { setFollow(true); scrollToSegment(activeId); }}
          className="absolute bottom-24 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink-2 shadow-pop hover:bg-subtle"
        >
          <ChevronUp className="size-4" /> Sync with audio
        </button>
      )}
    </div>
  );
}
