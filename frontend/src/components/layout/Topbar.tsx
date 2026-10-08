"use client";

import { Bell, ChevronDown, ClipboardPaste, FilePlus2, Search, Sparkles, Upload, Video } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useComingSoon } from "@/components/providers/ComingSoonProvider";
import { NavDrawer } from "./NavDrawer";
import { useCreateMeeting } from "@/components/meetings/CreateMeetingModal";
import { useCommandPalette } from "@/components/search/CommandPalette";
import { Button } from "@/components/ui/Button";
import { MenuItem, MenuSeparator, Popover } from "@/components/ui/Popover";
import { Kbd } from "@/components/ui/Primitives";
import { formatShortDate } from "@/lib/format";
import { useMeetings } from "@/lib/queries";

export function SearchTrigger({ className = "w-[380px]" }: { className?: string }) {
  const palette = useCommandPalette();
  return (
    <button
      type="button"
      onClick={() => palette.open()}
      className={`flex h-9 items-center gap-2 rounded-lg border border-line bg-subtle px-3 text-left text-[14px] text-ink-5 hover:border-line-strong ${className}`}
    >
      <Search className="size-4" />
      <span className="flex-1 truncate">Search by title or keyword</span>
      <Kbd>Ctrl + K</Kbd>
    </button>
  );
}

/** Bell menu: recent meetings whose notes are ready (derived from the library). */
export function NotificationsBell() {
  const { data } = useMeetings({ page_size: 5 });
  return (
    <Popover
      align="end"
      className="w-80 p-0"
      trigger={({ toggle }) => (
        <button onClick={toggle} aria-label="Notifications" className="relative rounded-lg p-2 text-ink-3 hover:bg-muted">
          <Bell className="size-5" strokeWidth={1.75} />
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-danger ring-2 ring-surface" />
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="border-b border-line px-4 py-3 text-[14px] font-semibold text-ink">Notifications</div>
          <div className="max-h-80 overflow-y-auto p-1">
            {data?.items.map((m) => (
              <Link key={m.id} href={`/meetings/${m.id}`} onClick={close} className="flex gap-3 rounded-lg px-3 py-2.5 hover:bg-muted">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
                  <Sparkles className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] text-ink-2">
                    Notes are ready for <b className="font-medium text-ink">{m.title}</b>
                  </span>
                  <span className="text-xs text-ink-5">{formatShortDate(m.started_at)}</span>
                </span>
              </Link>
            ))}
            {!data?.items.length && <p className="px-3 py-6 text-center text-[13px] text-ink-5">You&apos;re all caught up</p>}
          </div>
        </div>
      )}
    </Popover>
  );
}

/** Purple "Capture" split button: live capture is a placeholder; the menu creates meetings. */
export function CaptureButton() {
  const comingSoon = useComingSoon();
  const create = useCreateMeeting();
  return (
    <div className="flex">
      <Button
        variant="primary"
        className="rounded-r-none"
        onClick={() => comingSoon({ name: "Capture a live meeting", description: "Fred joins your Zoom, Meet or Teams call to record and transcribe it in real time. In this demo, add meetings by uploading or pasting a transcript instead." })}
      >
        <Video className="size-4" /> Capture
      </Button>
      <Popover
        align="end"
        className="w-60"
        trigger={({ toggle }) => (
          <Button variant="primary" aria-label="More capture options" className="w-8 rounded-l-none border-l border-white/25 px-0" onClick={toggle}>
            <ChevronDown className="size-4" />
          </Button>
        )}
      >
        {(close) => (
          <>
            <MenuItem icon={<Upload />} onClick={() => { close(); create("upload"); }}>Upload transcript file</MenuItem>
            <MenuItem icon={<ClipboardPaste />} onClick={() => { close(); create("paste"); }}>Paste transcript</MenuItem>
            <MenuItem icon={<FilePlus2 />} onClick={() => { close(); create("manual"); }}>Create meeting manually</MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Video />} onClick={() => { close(); comingSoon("Invite Fred to a live meeting"); }}>Add Fred to live meeting</MenuItem>
          </>
        )}
      </Popover>
    </div>
  );
}

/** "Free plan" chip + green Upgrade button, as in the real top bar. */
export function PlanBadge() {
  return (
    <div className="hidden items-center gap-2 lg:flex">
      <span className="inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap text-ink-3">
        <span className="rounded bg-success-soft px-1.5 py-0.5 text-[11px] font-semibold text-success">FREE</span> plan
      </span>
      <Link href="/upgrade" className="rounded-lg border border-success/40 bg-success-soft px-3 py-1.5 text-[13px] font-medium whitespace-nowrap text-success hover:border-success">
        Upgrade
      </Link>
    </div>
  );
}

export function Topbar({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 sm:gap-4 sm:px-5">
      <NavDrawer className="md:hidden" />
      <div className="min-w-0 flex-1 truncate text-[15px] text-ink-2">{title}</div>
      <SearchTrigger className="hidden w-[380px] md:flex" />
      <div className="flex flex-1 items-center justify-end gap-2">
        {children}
        <PlanBadge />
        <NotificationsBell />
        <CaptureButton />
      </div>
    </header>
  );
}
