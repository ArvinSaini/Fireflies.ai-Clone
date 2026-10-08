"use client";

import { Download, ListPlus, Pause, Play, RotateCcw, RotateCw, Star, ThumbsDown, ThumbsUp } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { MenuItem, Popover } from "@/components/ui/Popover";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Primitives";
import { api } from "@/lib/api";
import { formatTimestamp } from "@/lib/format";
import { useHotkey } from "@/lib/hooks";
import { useMeetingMutation } from "@/lib/queries";
import type { Chapter, Segment } from "@/lib/types";
import { cn, downloadUrl } from "@/lib/utils";
import { RATES, activeSegmentIndex, usePlayer } from "./PlayerContext";

/** Seek bar: click/drag anywhere; chapter boundaries are marked; hovering shows the time + chapter. */
function SeekBar({ chapters }: { chapters: Chapter[] }) {
  const { currentMs, durationMs, seek } = usePlayer();
  const track = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const pct = durationMs ? (currentMs / durationMs) * 100 : 0;

  const msAt = (clientX: number) => {
    const rect = track.current!.getBoundingClientRect();
    return Math.round(((clientX - rect.left) / rect.width) * durationMs);
  };
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    seek(msAt(e.clientX));
  };
  const hoverChapter = hover != null ? chapters.find((c) => hover >= c.start_ms && hover <= c.end_ms) : undefined;

  return (
    <div
      ref={track}
      role="slider"
      tabIndex={0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={durationMs}
      aria-valuenow={Math.round(currentMs)}
      aria-valuetext={formatTimestamp(currentMs)}
      onPointerDown={onPointerDown}
      onPointerMove={(e) => { setHover(msAt(e.clientX)); if (e.buttons === 1) seek(msAt(e.clientX)); }}
      onPointerLeave={() => setHover(null)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") seek(currentMs + 5000);
        if (e.key === "ArrowLeft") seek(currentMs - 5000);
      }}
      className="group absolute inset-x-0 -top-[7px] h-[14px] cursor-pointer touch-none"
    >
      <div className="absolute inset-x-0 top-[6px] h-[3px] bg-line transition-all group-hover:top-[5px] group-hover:h-[5px]">
        <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
        {chapters.slice(1).map((c) => (
          <span key={c.id} className="absolute top-0 h-full w-[2px] bg-surface" style={{ left: `${(c.start_ms / durationMs) * 100}%` }} />
        ))}
      </div>
      <span className="absolute top-[2px] size-3 -translate-x-1/2 rounded-full border-2 border-surface bg-brand opacity-0 shadow transition-opacity group-hover:opacity-100"
        style={{ left: `${pct}%` }} />
      {hover != null && (
        <span className="pointer-events-none absolute bottom-5 -translate-x-1/2 rounded-md bg-ink px-2 py-1 text-xs whitespace-nowrap text-surface shadow"
          style={{ left: `${(hover / durationMs) * 100}%` }}>
          {formatTimestamp(hover)}{hoverChapter && ` · ${hoverChapter.title}`}
        </span>
      )}
    </div>
  );
}

function AddTaskAtMoment({ meetingId, segments, open, onClose }: { meetingId: number; segments: Segment[]; open: boolean; onClose: () => void }) {
  const { currentMs } = usePlayer();
  const [text, setText] = useState("");
  const idx = activeSegmentIndex(segments.map((s) => s.start_ms), currentMs);
  const seg = segments[Math.max(0, idx)];
  const add = useMeetingMutation(meetingId, () => api.addActionItem(meetingId, { text: text.trim(), segment_id: seg?.id }), { success: "Action item added at this moment" });
  return (
    <Modal open={open} onClose={onClose} size="sm" title="Create task at this moment"
      description={seg ? `${formatTimestamp(seg.start_ms)} · ${seg.speaker?.name ?? "Speaker"}: “${seg.text.slice(0, 90)}${seg.text.length > 90 ? "…" : ""}”` : undefined}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!text.trim()} onClick={() => add.mutate(undefined, { onSuccess: () => { setText(""); onClose(); } })}>Add task</Button></>}>
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) add.mutate(undefined, { onSuccess: () => { setText(""); onClose(); } }); }}>
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Send pricing proposal to Northwind" />
      </form>
    </Modal>
  );
}

export function PlayerBar({ meetingId, chapters, segments }: { meetingId: number; chapters: Chapter[]; segments: Segment[] }) {
  const { currentMs, durationMs, playing, rate, toggle, skip, setRate } = usePlayer();
  const [starred, setStarred] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);

  useHotkey((e) => e.code === "Space", (e) => { e.preventDefault(); toggle(); });
  useHotkey((e) => e.key === "ArrowRight" && e.altKey, () => skip(15000));
  useHotkey((e) => e.key === "ArrowLeft" && e.altKey, () => skip(-15000));

  const btn = "rounded-lg p-2 text-ink-3 hover:bg-muted hover:text-ink [&_svg]:size-5";
  return (
    <div className="relative z-20 flex h-16 shrink-0 items-center border-t border-line bg-surface px-5">
      <SeekBar chapters={chapters} />
      <div className="text-[13px] text-ink-2 tabular-nums sm:w-40 sm:text-[14px]">
        {formatTimestamp(currentMs)} <span className="text-ink-5">/ {formatTimestamp(durationMs)}</span>
      </div>

      <div className="flex flex-1 items-center justify-center gap-1 sm:gap-3">
        <Popover side="top" className="w-28" trigger={({ toggle: t }) => (
          <button onClick={t} className="w-12 rounded-lg py-1.5 text-[14px] font-medium text-ink-3 hover:bg-muted" title="Playback speed">{rate}x</button>
        )}>
          {(close) => RATES.map((r) => (
            <MenuItem key={r} onClick={() => { setRate(r); close(); }} badge={r === rate ? <span className="text-brand">✓</span> : null}>{r}x</MenuItem>
          ))}
        </Popover>
        <button onClick={() => skip(-15000)} className={btn} aria-label="Back 15 seconds" title="Back 15s (Alt+←)"><RotateCcw /></button>
        <button
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          title={`${playing ? "Pause" : "Play"} (Space)`}
          className={cn("flex h-10 w-[60px] items-center justify-center rounded-full text-white transition-colors", playing ? "bg-ink hover:bg-ink-2" : "bg-brand hover:bg-brand-hover")}
        >
          {playing ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current" />}
        </button>
        <button onClick={() => skip(15000)} className={btn} aria-label="Forward 15 seconds" title="Forward 15s (Alt+→)"><RotateCw /></button>
        <Popover side="top" align="end" className="w-56" trigger={({ toggle: t }) => (
          <button onClick={t} className={cn(btn, "hidden sm:block")} aria-label="Download" title="Download"><Download /></button>
        )}>
          {(close) => (
            <>
              <MenuItem onClick={() => { close(); downloadUrl(api.exportUrl(meetingId, "md")); }}>Notes + transcript (.md)</MenuItem>
              <MenuItem onClick={() => { close(); downloadUrl(api.exportUrl(meetingId, "txt")); }}>Transcript (.txt)</MenuItem>
              <MenuItem onClick={() => { close(); downloadUrl(api.exportUrl(meetingId, "json")); }}>Data (.json)</MenuItem>
              <MenuItem onClick={() => { close(); window.print(); }}>Print / save as PDF</MenuItem>
            </>
          )}
        </Popover>
      </div>

      <div className="hidden w-40 items-center justify-end gap-1 md:flex">
        <button onClick={() => { setStarred(!starred); toast.success(starred ? "Removed from starred" : "Meeting starred"); }}
          className={btn} aria-label="Star meeting" title="Star"><Star className={cn(starred && "fill-[#fdb022] text-[#fdb022]")} /></button>
        <button onClick={() => setTaskOpen(true)} className={btn} aria-label="Create task at this moment" title="Create task at this moment"><ListPlus /></button>
        <button onClick={() => toast.success("Thanks for the feedback!")} className={btn} aria-label="Good notes" title="Good notes"><ThumbsUp /></button>
        <button onClick={() => toast("Thanks — feedback helps improve the notes.")} className={btn} aria-label="Bad notes" title="Bad notes"><ThumbsDown /></button>
      </div>
      <AddTaskAtMoment meetingId={meetingId} segments={segments} open={taskOpen} onClose={() => setTaskOpen(false)} />
    </div>
  );
}
