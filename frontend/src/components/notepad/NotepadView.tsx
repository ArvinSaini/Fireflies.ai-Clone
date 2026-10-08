"use client";

import { FileQuestion, Maximize2, Minimize2, Pencil } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { MeetingDetailsDrawer } from "@/components/meetings/MeetingDialogs";
import { Button } from "@/components/ui/Button";
import { EmptyState, Skeleton } from "@/components/ui/Primitives";
import { ApiError } from "@/lib/api";
import { useMeeting, useTranscript } from "@/lib/queries";
import type { MeetingDetail, Segment } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AskFredPanel } from "./AskFredPanel";
import { NotepadProvider, useNotepad } from "./NotepadContext";
import { NotepadTopbar } from "./NotepadTopbar";
import { PlayerBar } from "./PlayerBar";
import { PlayerProvider, usePlayer } from "./PlayerContext";
import { BookmarksPanel, CommentsPanel, LeftRail, SmartSearchPanel, SoundbitesPanel } from "./RailPanels";
import { SummaryColumn } from "./SummaryColumn";
import { TranscriptPanel } from "./TranscriptPanel";

/** Applies a `?t=<ms>` deep link (from global search / copied moment links) once the player is ready. */
function DeepLinkSeek({ segments }: { segments: Segment[] }) {
  const params = useSearchParams();
  const { seek } = usePlayer();
  const { setFocusSegment } = useNotepad();
  const t = Number(params.get("t"));
  useEffect(() => {
    if (!t || !segments.length) return;
    seek(t);
    const seg = segments.find((s) => s.start_ms === t) ?? segments.findLast((s) => s.start_ms <= t);
    if (seg) setFocusSegment(seg.id);
  }, [t, segments, seek, setFocusSegment]);
  return null;
}

function Workspace({ meeting, segments }: { meeting: MeetingDetail; segments: Segment[] }) {
  const { panel, rightTab, setRightTab } = useNotepad();
  const [expand, setExpand] = useState<"none" | "notes" | "transcript">("none");
  const [editing, setEditing] = useState(false);
  const [info, setInfo] = useState(false);
  // Below lg the page shows one pane at a time: the notes or the transcript/AskFred panel.
  const [mobilePane, setMobilePane] = useState<"notes" | "panel">("notes");

  return (
    <div className="flex h-full flex-col bg-surface">
      <NotepadTopbar meeting={meeting} onInfo={() => setInfo(true)} />
      <div className="flex shrink-0 gap-1 border-b border-line p-2 lg:hidden">
        {(["notes", "panel"] as const).map((p) => (
          <button key={p} onClick={() => setMobilePane(p)}
            className={cn("flex-1 rounded-md py-1.5 text-[13px] font-medium", mobilePane === p ? "bg-brand-soft text-brand-hover" : "text-ink-3")}>
            {p === "notes" ? "Notes" : "Transcript & AskFred"}
          </button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1">
        <LeftRail />
        {panel === "search" && <SmartSearchPanel meetingId={meeting.id} segments={segments} />}
        {panel === "soundbites" && <SoundbitesPanel meetingId={meeting.id} segments={segments} />}
        {panel === "comments" && <CommentsPanel meetingId={meeting.id} segments={segments} />}
        {panel === "bookmarks" && <BookmarksPanel meetingId={meeting.id} segments={segments} />}

        {expand !== "transcript" && (
          <main className={cn("min-w-0 flex-1 overflow-y-auto", mobilePane === "panel" && "hidden lg:block")}>
            <SummaryColumn meeting={meeting} expanded={expand === "notes"} onToggleExpand={() => setExpand(expand === "notes" ? "none" : "notes")} />
          </main>
        )}

        {expand !== "notes" && (
          <aside className={cn("relative min-w-0 flex-col border-line lg:flex lg:border-l",
            mobilePane === "panel" ? "flex flex-1" : "hidden",
            expand === "transcript" ? "lg:flex-1" : "lg:w-[38%] lg:max-w-[560px] lg:min-w-[380px] lg:flex-none")}>
            <div className="flex h-14 shrink-0 items-center gap-6 border-b border-line px-5">
              {(["askfred", "transcript"] as const).map((t) => (
                <button key={t} onClick={() => setRightTab(t)}
                  className={cn("relative flex h-full items-center gap-2 text-[15px] transition-colors",
                    rightTab === t ? "text-brand after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-brand" : "text-ink-3 hover:text-ink")}>
                  {t === "askfred" && <span className="flex size-6 items-center justify-center rounded-md bg-brand-soft text-[13px]">🤖</span>}
                  {t === "transcript" ? "Transcript" : "AskFred"}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-1">
                <button onClick={() => setExpand(expand === "transcript" ? "none" : "transcript")} title={expand === "transcript" ? "Exit full screen" : "Full screen transcript"}
                  aria-label="Toggle full screen transcript" className="rounded-md p-1.5 text-ink-4 hover:bg-muted hover:text-ink">
                  {expand === "transcript" ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                </button>
                {rightTab === "transcript" && (
                  <button onClick={() => setEditing(!editing)} title={editing ? "Done editing" : "Edit transcript"} aria-pressed={editing}
                    className={cn("rounded-md p-1.5 hover:bg-muted", editing ? "bg-brand-soft text-brand" : "text-ink-4 hover:text-ink")}>
                    <Pencil className="size-4" />
                  </button>
                )}
              </div>
            </div>
            {editing && rightTab === "transcript" && (
              <div className="flex items-center justify-between bg-brand-soft px-5 py-2 text-[13px] text-brand-hover">
                Editing transcript — changes save when you click away.
                <Button size="xs" variant="primary" onClick={() => setEditing(false)}>Done</Button>
              </div>
            )}
            {rightTab === "transcript" ? (
              segments.length ? (
                <TranscriptPanel segments={segments} editing={editing} />
              ) : (
                <EmptyState icon={<FileQuestion />} title="No transcript" description="This meeting was created without a transcript. Upload one to get AI notes." />
              )
            ) : (
              <AskFredPanel meetingId={meeting.id} />
            )}
          </aside>
        )}
      </div>
      <PlayerBar meetingId={meeting.id} chapters={meeting.chapters} segments={segments} />
      <DeepLinkSeek segments={segments} />
      {info && <MeetingDetailsDrawer meeting={{ ...meeting, overview: meeting.summary?.overview ?? null, action_items_total: meeting.action_items.length, action_items_open: meeting.action_items.filter((a) => !a.is_completed).length }} onClose={() => setInfo(false)} />}
    </div>
  );
}

export function NotepadView({ id }: { id: number }) {
  const meeting = useMeeting(id);
  const transcript = useTranscript(id);

  if (meeting.error) {
    const notFound = meeting.error instanceof ApiError && meeting.error.status === 404;
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          icon={<FileQuestion />}
          title={notFound ? "Meeting not found" : "Couldn't load this meeting"}
          description={notFound ? "It may have been deleted." : meeting.error.message}
          action={<Link href="/meetings"><Button variant="primary">Back to meetings</Button></Link>}
        />
      </div>
    );
  }
  if (!meeting.data || !transcript.data) {
    return (
      <div className="flex h-full flex-col">
        <div className="h-14 border-b border-line" />
        <div className="flex flex-1">
          <div className="w-[60px] border-r border-line" />
          <div className="mx-auto w-full max-w-[760px] space-y-4 p-10">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="mt-10 h-32" />
            <Skeleton className="h-48" />
          </div>
          <div className="w-[38%] space-y-4 border-l border-line p-6">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
        </div>
      </div>
    );
  }
  const durationMs = Math.max(meeting.data.duration_ms, transcript.data.at(-1)?.end_ms ?? 0, 1000);
  return (
    <PlayerProvider durationMs={durationMs} mediaUrl={meeting.data.media_url}>
      <NotepadProvider meetingId={id}>
        <Workspace meeting={meeting.data} segments={transcript.data} />
      </NotepadProvider>
    </PlayerProvider>
  );
}
