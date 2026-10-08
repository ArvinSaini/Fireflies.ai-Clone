"use client";

import {
  Copy, Download, Eye, Globe2, Info, Link2, MoreHorizontal, PenLine, Plus, RefreshCw, Share2, Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { NavDrawer } from "@/components/layout/NavDrawer";
import { NotificationsBell } from "@/components/layout/Topbar";
import { copyMeetingLink } from "@/components/meetings/MeetingCard";
import { useCreateMeeting } from "@/components/meetings/CreateMeetingModal";
import { DeleteMeetingDialog, EditMeetingDialog } from "@/components/meetings/MeetingDialogs";
import { useComingSoon } from "@/components/providers/ComingSoonProvider";
import { Avatar } from "@/components/ui/Avatar";
import { NewBadge } from "@/components/ui/Primitives";
import { MenuItem, MenuSeparator, Popover } from "@/components/ui/Popover";
import { api } from "@/lib/api";
import { useMe, useMeetingMutation } from "@/lib/queries";
import type { MeetingDetail } from "@/lib/types";
import { downloadUrl } from "@/lib/utils";

const INTEGRATIONS = [
  { name: "Slack", color: "#4a154b", letter: "S" },
  { name: "Google Docs", color: "#2684fc", letter: "D" },
  { name: "Notion", color: "#111", letter: "N" },
  { name: "Monday.com", color: "#ff3d57", letter: "M" },
];

export function NotepadTopbar({ meeting, onInfo }: { meeting: MeetingDetail; onInfo: () => void }) {
  const comingSoon = useComingSoon();
  const createMeeting = useCreateMeeting();
  const { data: me } = useMe();
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
  const regenerate = useMeetingMutation(meeting.id, () => api.regenerate(meeting.id), { success: "Notes regenerated" });
  const channel = meeting.channels[0];

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-3">
      <NavDrawer />
      <nav className="flex min-w-0 items-center gap-2 text-[14px]" aria-label="Breadcrumb">
        <Link href={channel ? `/meetings?channel=${channel.id}` : "/meetings"} className="hidden shrink-0 text-ink-3 hover:text-ink sm:inline">
          #{channel ? channel.name : "My Meetings"}
        </Link>
        <span className="hidden text-ink-5 sm:inline">/</span>
        <span className="truncate text-ink-2">{meeting.title}</span>
      </nav>
      <Popover
        className="w-56"
        trigger={({ toggle }) => (
          <button onClick={toggle} aria-label="Meeting options" className="rounded-lg p-1.5 text-ink-3 hover:bg-muted"><MoreHorizontal className="size-5" /></button>
        )}
      >
        {(close) => (
          <>
            <MenuItem icon={<Share2 />} onClick={() => { close(); copyMeetingLink(meeting.id); }}>Share</MenuItem>
            <MenuItem icon={<Copy />} onClick={() => { close(); copyMeetingLink(meeting.id); }}>Copy Link</MenuItem>
            <MenuSeparator />
            <MenuItem icon={<RefreshCw />} badge={<NewBadge tone="purple">New</NewBadge>} disabled={!meeting.segment_count}
              onClick={() => { close(); regenerate.mutate(undefined); }}>Regenerate notes</MenuItem>
            <MenuItem icon={<PenLine />} onClick={() => { close(); setDialog("edit"); }}>Rename / edit details</MenuItem>
            <MenuItem icon={<Globe2 />} onClick={() => { close(); setDialog("edit"); }}>Update Language</MenuItem>
            <MenuItem icon={<Info />} onClick={() => { close(); onInfo(); }}>Meeting info</MenuItem>
            <MenuItem icon={<Download />} onClick={() => { close(); downloadUrl(api.exportUrl(meeting.id, "md")); }}>Download</MenuItem>
            <MenuSeparator />
            <MenuItem danger icon={<Trash2 />} onClick={() => { close(); setDialog("delete"); }}>Delete meeting</MenuItem>
          </>
        )}
      </Popover>

      <div className="ml-auto flex items-center gap-2">
        <Popover
          align="end"
          className="w-64"
          trigger={({ toggle }) => (
            <button onClick={toggle} className="hidden items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-muted lg:flex" aria-label="Send to apps">
              <span className="grid size-5 grid-cols-2 gap-0.5">
                {["#36c5f0", "#2eb67d", "#ecb22e", "#e01e5a"].map((c) => <span key={c} className="rounded-sm" style={{ background: c }} />)}
              </span>
            </button>
          )}
        >
          {(close) => INTEGRATIONS.map((i) => (
            <button key={i.name} onClick={() => { close(); comingSoon(`${i.name} integration`); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted">
              <span className="flex size-7 items-center justify-center rounded-md text-xs font-bold text-white" style={{ background: i.color }}>{i.letter}</span>
              <span className="flex-1 text-left">
                <span className="block text-[14px] text-ink">{i.name}</span>
                <span className="text-xs text-ink-4">Connect</span>
              </span>
              <Plus className="size-4 text-brand" />
            </button>
          ))}
        </Popover>
        <span className="hidden items-center gap-1.5 px-2 text-[13px] text-ink-4 sm:flex"><Eye className="size-4" /> 1 View</span>
        <div className="flex">
          <button onClick={() => comingSoon({ name: "Share with teammates", description: "Share meeting notes with your team or anyone via a public link. Use the link button to copy this meeting's URL." })}
            className="flex h-9 items-center gap-1.5 rounded-l-lg bg-brand px-3 text-[14px] font-medium text-white hover:bg-brand-hover">
            <Globe2 className="size-4" /> <span className="hidden sm:inline">Share</span>
          </button>
          <button onClick={() => copyMeetingLink(meeting.id)} aria-label="Copy link" title="Copy link"
            className="flex h-9 items-center rounded-r-lg border-l border-white/25 bg-brand px-2.5 text-white hover:bg-brand-hover">
            <Link2 className="size-4" />
          </button>
        </div>
        <span className="mx-1 hidden h-6 w-px bg-line sm:block" />
        <button onClick={() => createMeeting("upload")} aria-label="Add meeting" className="hidden rounded-lg border border-line p-2 text-ink-3 hover:bg-muted sm:block"><Plus className="size-4" /></button>
        <NotificationsBell />
        <Link href="/settings" aria-label="Settings"><Avatar name={me?.name ?? "?"} color={me?.avatar_color} size="md" /></Link>
      </div>

      {dialog === "edit" && <EditMeetingDialog meeting={meeting} open onClose={() => setDialog(null)} />}
      {dialog === "delete" && <DeleteMeetingDialog meeting={meeting} open onClose={() => setDialog(null)} />}
    </header>
  );
}
