"use client";

import { ArrowRight, ChevronDown, ChevronUp, Smartphone, Zap } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useComingSoon } from "@/components/providers/ComingSoonProvider";
import { Avatar } from "@/components/ui/Avatar";
import { LogoMark } from "@/components/ui/Logo";
import { Popover } from "@/components/ui/Popover";
import { AppStoreIcon, ChromeIcon, PlayStoreIcon } from "@/components/ui/StoreIcons";
import { firstName } from "@/lib/format";
import { useMe, useStats } from "@/lib/queries";
import { cn } from "@/lib/utils";

const FREE_MEETINGS = 3; // free-plan allowance shown in the top bar too (placeholder)
const STORAGE_MINS = 400;

function Meter({ value, max }: { value: number; max: number }) {
  return (
    <div className="mt-2 h-1 overflow-hidden rounded-full bg-success-soft">
      <div className="h-full rounded-full bg-success" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  );
}

const rowCls = "flex w-full items-center justify-between px-4 py-1.5 text-left text-[14px] text-ink-2 hover:bg-muted";

/** Account menu opened from the profile button in the expanded sidebar, laid out like the live app. */
export function ProfileMenu() {
  const { data: me } = useMe();
  const { data: stats } = useStats();
  const { theme, setTheme } = useTheme();
  const comingSoon = useComingSoon();
  const name = me ? firstName(me.name) : "…";
  const usedMins = Math.round((stats?.total_duration_ms ?? 0) / 60000);

  return (
    <Popover
      className="max-h-[calc(100dvh-90px)] w-[640px] max-w-[calc(100vw-24px)] overflow-y-auto p-0"
      trigger={({ open, toggle }) => (
        <button type="button" onClick={toggle} aria-label="Account menu" className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted">
          <Avatar name={me?.name ?? "…"} color={me?.avatar_color} size="sm" />
          <span className="max-w-32 truncate text-[15px] font-medium text-ink">{name}</span>
          {open ? <ChevronUp className="size-4 text-ink-4" /> : <ChevronDown className="size-4 text-ink-4" />}
        </button>
      )}
    >
      {(close) => {
        const soon = (feature: string | { name: string; description?: string }) => { close(); comingSoon(feature); };
        return (
          <div className="flex gap-2 p-1.5">
            {/* Account column */}
            <div className="w-[290px] shrink-0 overflow-hidden rounded-xl border border-line">
              <div className="border-b border-line px-4 py-3">
                <p className="text-[16px] font-medium text-ink">Hi {name}</p>
                <p className="text-[13px] text-ink-4">{me?.email}</p>
              </div>
              <div className="border-b border-line px-4 py-3">
                <p className="text-[14px] font-medium text-ink">Free</p>
                <Meter value={FREE_MEETINGS} max={FREE_MEETINGS} />
                <p className="mt-2 text-[12px] text-ink-4">{FREE_MEETINGS} left / {FREE_MEETINGS} free meetings</p>
                <Link
                  href="/upgrade"
                  onClick={close}
                  className="mt-2.5 flex h-8 items-center justify-center gap-1.5 rounded-lg border border-success/40 bg-success-soft text-[14px] font-medium text-success hover:border-success"
                >
                  <Zap className="size-3.5 fill-current" /> Upgrade
                </Link>
              </div>
              <div className="border-b border-line px-4 py-3">
                <p className="text-[14px] font-medium text-ink">Storage</p>
                <Meter value={usedMins} max={STORAGE_MINS} />
                <p className="mt-2 text-[12px] text-ink-4">{usedMins} / {STORAGE_MINS} mins</p>
              </div>
              <button type="button" className={cn(rowCls, "border-b border-line py-2.5")} onClick={() => soon({ name: "Refer and Earn $5", description: "Invite friends to Fireflies and earn credit for each sign-up." })}>
                Refer and Earn $5
              </button>
              <div className="py-1.5">
                <button type="button" className={rowCls} onClick={() => soon({ name: "Playlists", description: "Group soundbites from many meetings into a shareable playlist." })}>Playlist</button>
                <Link href="/settings" onClick={close} className={rowCls}>Settings</Link>
                <button type="button" className={rowCls} onClick={() => soon("Teams & sharing")}>My Team</button>
                <button type="button" className={rowCls} onClick={() => soon({ name: "Manage Web Logins", description: "See and sign out the browsers where your account is logged in." })}>Manage Web Logins</button>
                <button type="button" className={rowCls} onClick={() => soon({ name: "Platform Rules", description: "Auto-join and recording rules for each meeting platform." })}>Platform Rules</button>
                <button type="button" className={rowCls} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                  <span className="flex items-center gap-2">
                    Theme <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[11px] font-semibold text-brand">BETA</span>
                  </span>
                  <span className="text-[12px] text-ink-4">{theme === "dark" ? "Dark" : "Light"}</span>
                </button>
                <button type="button" className={rowCls} onClick={() => soon("Sign out & multiple accounts")}>Logout</button>
              </div>
            </div>

            {/* Apps column */}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="rounded-xl border border-line p-4">
                <Smartphone className="size-6 text-[#e04f7a]" strokeWidth={1.5} />
                <p className="mt-3 text-[15px] font-medium text-ink">Mobile App</p>
                <p className="mt-0.5 text-[13px] text-ink-3">Transcribe and summarize in-person conversations with mobile app.</p>
                <div className="mt-3 flex gap-2">
                  {[{ label: "App Store", icon: <AppStoreIcon /> }, { label: "Google Play", icon: <PlayStoreIcon /> }].map((s) => (
                    <button key={s.label} type="button" aria-label={s.label} onClick={() => soon("Mobile App")}
                      className="flex size-9 items-center justify-center rounded-md border border-line bg-subtle hover:border-line-strong">
                      {s.icon}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-line p-4">
                <ChromeIcon />
                <p className="mt-3 text-[15px] font-medium text-ink">Chrome Extension</p>
                <p className="mt-0.5 text-[13px] text-ink-3">Record and transcribe Google Meet calls without Fireflies notetaker bot.</p>
                <button type="button" onClick={() => soon({ name: "Chrome Extension", description: "Records Google Meet calls from your browser, without a bot." })}
                  className="mt-3 rounded-md border border-line bg-subtle px-3 py-1.5 text-[13px] font-medium text-ink hover:border-line-strong">
                  Install
                </button>
              </div>
              <button type="button" onClick={() => soon({ name: "Desktop App", description: "Record meetings from your Mac or Windows computer without a bot in the call." })}
                className="flex items-center gap-3 rounded-xl border border-brand/60 bg-brand-soft/40 px-3 py-2.5 text-left text-[13px] font-medium text-ink hover:bg-brand-soft">
                <span className="flex size-8 items-center justify-center rounded-lg bg-surface"><LogoMark className="size-5" /></span>
                <span className="flex-1">Download Fireflies Desktop App</span>
                <ArrowRight className="size-4 text-ink-3" />
              </button>
            </div>
          </div>
        );
      }}
    </Popover>
  );
}
