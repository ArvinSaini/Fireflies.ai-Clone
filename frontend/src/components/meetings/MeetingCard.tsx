"use client";

import { ChevronRight, Copy, Download, Hash, Lock, MoreHorizontal, PenLine, Share2, Trash2, FolderInput } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { MenuItem, MenuSeparator, Popover } from "@/components/ui/Popover";
import { Checkbox } from "@/components/ui/Primitives";
import { api } from "@/lib/api";
import { formatDuration, formatShortDate, formatTime } from "@/lib/format";
import type { MeetingListItem } from "@/lib/types";
import { cn, downloadUrl } from "@/lib/utils";
import { DeleteMeetingDialog, EditMeetingDialog, MoveToChannelDialog } from "./MeetingDialogs";
import { PlatformIcon } from "./PlatformIcon";

export function copyMeetingLink(id: number) {
  void navigator.clipboard?.writeText(`${window.location.origin}/meetings/${id}`);
  toast.success("Link copied to clipboard");
}

export function MeetingCard({
  meeting, selected, onSelect, onDetails, selectionMode,
}: {
  meeting: MeetingListItem;
  selected: boolean;
  onSelect: (v: boolean) => void;
  onDetails: () => void;
  selectionMode: boolean;
}) {
  const [dialog, setDialog] = useState<"edit" | "move" | "delete" | null>(null);
  const meta = [formatShortDate(meeting.started_at), formatTime(meeting.started_at), formatDuration(meeting.duration_ms), meeting.host?.name]
    .filter(Boolean);

  return (
    <div
      className={cn(
        "group relative flex gap-4 rounded-xl border bg-surface p-5 transition-colors",
        selected ? "border-brand-200 bg-brand-soft/40" : "border-line hover:bg-subtle",
      )}
    >
      <div className="relative">
        <Avatar name={meeting.host?.name ?? meeting.title} size="lg" className={cn("transition-opacity", selectionMode && "opacity-0")} />
        <div className={cn("absolute inset-0 flex items-center justify-center", selectionMode ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
          <span className={cn("flex size-12 items-center justify-center rounded-lg", !selectionMode && "bg-surface/90")}>
            <Checkbox checked={selected} onChange={onSelect} label={`Select ${meeting.title}`} className="size-5" />
          </span>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <Link href={`/meetings/${meeting.id}`} className="inline-flex max-w-full items-center gap-1.5 after:absolute after:inset-0">
          <span className="truncate text-[16px] font-medium text-ink">{meeting.title}</span>
          <ChevronRight className="size-4 shrink-0 text-ink-3" />
          <PlatformIcon platform={meeting.platform} />
        </Link>
        <p className="mt-1 text-[14px] text-ink-4">
          {meta.map((m, i) => (
            <span key={i}>
              {i > 0 && <span className="mx-1.5">·</span>}
              {m}
            </span>
          ))}
        </p>
        {meeting.channels.length > 0 && (
          <div className="mt-3.5 flex flex-wrap gap-3">
            {meeting.channels.map((c) => (
              <Link key={c.id} href={`/meetings?channel=${c.id}`} className="relative z-10 inline-flex items-center gap-0.5 text-[14px] text-ink-2 hover:text-brand">
                {c.is_private ? <Lock className="size-3.5" /> : <Hash className="size-3.5" />}
                {c.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="relative z-10 hidden items-start gap-2 group-focus-within:flex group-hover:flex">
        <Popover
          align="end"
          className="w-52"
          trigger={({ toggle }) => (
            <Button aria-label="Meeting actions" className="w-9 px-0" onClick={toggle}>
              <MoreHorizontal className="size-4" />
            </Button>
          )}
        >
          {(close) => (
            <>
              <MenuItem icon={<Share2 />} onClick={() => { close(); copyMeetingLink(meeting.id); }}>Share</MenuItem>
              <MenuItem icon={<Copy />} onClick={() => { close(); copyMeetingLink(meeting.id); }}>Copy Link</MenuItem>
              <MenuItem icon={<Download />} onClick={() => { close(); downloadUrl(api.exportUrl(meeting.id, "md")); }}>Download</MenuItem>
              <MenuItem icon={<FolderInput />} onClick={() => { close(); setDialog("move"); }}>Move to channel</MenuItem>
              <MenuItem icon={<PenLine />} onClick={() => { close(); setDialog("edit"); }}>Rename / edit</MenuItem>
              <MenuSeparator />
              <MenuItem danger icon={<Trash2 />} onClick={() => { close(); setDialog("delete"); }}>Delete</MenuItem>
            </>
          )}
        </Popover>
        <Button onClick={onDetails}>
          Details <ChevronRight className="size-4" />
        </Button>
      </div>

      {dialog === "edit" && <EditMeetingDialog meeting={meeting} open onClose={() => setDialog(null)} />}
      {dialog === "move" && (
        <MoveToChannelDialog meetingIds={[meeting.id]} initial={meeting.channels.map((c) => c.id)} open onClose={() => setDialog(null)} />
      )}
      {dialog === "delete" && <DeleteMeetingDialog meeting={meeting} open onClose={() => setDialog(null)} />}
    </div>
  );
}
