"use client";

import {
  CalendarCog, CalendarDays, CalendarPlus, ChevronRight, Download, Monitor, Play, Plus, Smartphone, Sparkles, Upload,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { useCreateMeeting } from "@/components/meetings/CreateMeetingModal";
import { useComingSoon } from "@/components/providers/ComingSoonProvider";
import { Avatar } from "@/components/ui/Avatar";
import { LogoMark } from "@/components/ui/Logo";
import { AppStoreIcon, PlayStoreIcon } from "@/components/ui/StoreIcons";
import { EmptyState, Segmented, Skeleton } from "@/components/ui/Primitives";
import { firstName, formatRecentDate, formatShortDate } from "@/lib/format";
import { useMe, useMeetings } from "@/lib/queries";
import { ServerWaking } from "@/components/ui/ServerWaking";

type Tab = "recent" | "upcoming" | "feed";

const CAPTURE_INFO = {
  name: "Capture a live meeting",
  description: "Fred joins your Zoom, Meet or Teams call to record and transcribe it in real time. In this demo, add meetings by uploading or pasting a transcript instead.",
};

/** "Welcome Aboard" card with the product-demo video thumbnail. */
function WelcomeCard({ name }: { name: string }) {
  const comingSoon = useComingSoon();
  return (
    <section className="flex flex-col items-center gap-8 rounded-2xl border border-[#f5d5bd] bg-[#fdf1e7] px-8 py-10 sm:flex-row sm:px-[140px] dark:border-[#5c3418] dark:bg-[#3b2111]">
      <div className="flex-1">
        <h1 className="text-[24px] font-semibold tracking-tight text-ink">Welcome Aboard{name ? `, ${name}` : ""}!</h1>
        <p className="mt-3 max-w-[400px] text-[16px] leading-relaxed text-ink-3">
          Fireflies is now ready to automate your meetings and streamline your workflows.
        </p>
      </div>
      <button
        type="button"
        aria-label="Play product demo"
        onClick={() => comingSoon({ name: "Product demo video", description: "A two-minute tour of recording, summaries and AskFred." })}
        className="group relative h-[170px] w-[252px] shrink-0 overflow-hidden rounded-xl border-4 border-[#fbd9b4] bg-gradient-to-b from-[#6d28d9] via-[#3b1b8a] to-[#120a33] shadow-lg"
      >
        <span className="absolute top-8 left-1/2 flex -translate-x-1/2 items-center gap-1 text-[9px] whitespace-nowrap text-white/90">
          Fireflies <LogoMark className="size-3" /> Product Demo
        </span>
        <span className="absolute inset-x-5 top-14 bottom-0 rounded-t-lg border border-white/15 bg-white/5" />
        <span className="absolute top-[62px] left-1/2 flex h-10 w-[60px] -translate-x-1/2 items-center justify-center rounded-full bg-[#7c5cff] transition-transform group-hover:scale-110">
          <Play className="size-4 fill-white text-white" />
        </span>
        <Avatar name="Fred" size="sm" className="absolute bottom-3 left-2 rounded-full ring-2 ring-white/60" />
      </button>
    </section>
  );
}

function QuickStartCard({ label, icon, className, onClick }: { label: string; icon: React.ReactNode; className: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-[66px] items-center gap-3 rounded-lg border px-5 text-[16px] font-medium text-ink transition-opacity hover:opacity-85 ${className}`}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      <ChevronRight className="size-4 text-ink-3" />
    </button>
  );
}

export function HomeView() {
  const comingSoon = useComingSoon();
  const createMeeting = useCreateMeeting();
  const { data: me } = useMe();
  const { data: recent, isLoading } = useMeetings({ page_size: 8 });
  const [tab, setTab] = useState<Tab>("recent");

  return (
    <>
      <Topbar title="Home" />
      <main className="hero-wash relative flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1024px] px-6 pt-20 pb-24">
          <WelcomeCard name={me ? firstName(me.name) : ""} />

          <section className="mt-16">
            <h2 className="text-[22px] font-semibold tracking-tight text-ink">Quick Start</h2>
            <p className="mt-1.5 text-[16px] text-ink-3">Capture your first meeting or upload a recording to see Fireflies in action.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <QuickStartCard
                label="Schedule Meeting"
                icon={<CalendarPlus className="size-5 text-[#ee46bc]" strokeWidth={1.75} />}
                className="border-[#fbcfe8] bg-[#fdf2fa] dark:border-[#5c1f3c] dark:bg-[#3d1527]"
                onClick={() => comingSoon({ name: "Schedule Meeting", description: "Connect Google or Outlook Calendar and Fred joins your scheduled meetings automatically." })}
              />
              <QuickStartCard
                label="Upload File"
                icon={<Upload className="size-5 text-[#16b364]" strokeWidth={1.75} />}
                className="border-[#bbf7d0] bg-[#edfcf2] dark:border-[#14432f] dark:bg-[#0d2a20]"
                onClick={() => createMeeting("upload")}
              />
              <QuickStartCard
                label="Capture Meeting"
                icon={<Plus className="size-5 text-[#6172f3]" strokeWidth={1.75} />}
                className="border-[#c7d7fe] bg-[#eef4ff] dark:border-[#2a2b5c] dark:bg-[#1a1a3a]"
                onClick={() => comingSoon(CAPTURE_INFO)}
              />
            </div>
          </section>

          <section className="mt-12">
            <div className="flex items-center justify-between">
              <Segmented<Tab>
                variant="pill"
                value={tab}
                onChange={setTab}
                options={[
                  { value: "recent", label: "Recent" },
                  { value: "upcoming", label: "Upcoming" },
                  { value: "feed", label: "AI Feed" },
                ]}
              />
              <button onClick={() => comingSoon("Home feed settings")} className="flex items-center gap-1.5 text-[15px] text-ink-3 hover:text-ink">
                <CalendarCog className="size-4" /> Settings
              </button>
            </div>

            <div className="mt-4">
              {tab === "recent" && (
                <div>
                  {isLoading && <ServerWaking className="my-3" />}
                  {isLoading && Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="my-4 h-10" />)}
                  {recent?.items.map((m) => (
                    <Link key={m.id} href={`/meetings/${m.id}`} className="flex items-center gap-5 rounded-xl px-5 py-3 hover:bg-surface/70">
                      <Avatar name={m.host?.name ?? m.title} size="md" className="size-10" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16px] font-medium text-ink">{m.title}</span>
                        <span className="mt-0.5 block text-[15px] text-ink-4">{formatRecentDate(m.started_at)}</span>
                      </span>
                    </Link>
                  ))}
                  {!isLoading && !recent?.items.length && (
                    <EmptyState icon={<Upload />} title="No meetings yet" description="Upload a recording or paste a transcript to see Fireflies in action." />
                  )}
                </div>
              )}
              {tab === "upcoming" && (
                <EmptyState
                  icon={<CalendarDays />}
                  title="No upcoming meetings"
                  description="Connect Google or Outlook Calendar and Fred will auto-join your meetings."
                  action={<button className="text-[14px] font-medium text-brand" onClick={() => comingSoon("Calendar integration")}>Connect calendar →</button>}
                />
              )}
              {tab === "feed" && (
                <div className="space-y-3">
                  {recent?.items.filter((m) => m.overview).slice(0, 5).map((m) => (
                    <Link key={m.id} href={`/meetings/${m.id}`} className="block rounded-xl border border-line bg-surface p-4 shadow-xs hover:shadow-pop">
                      <div className="flex items-center gap-2 text-xs text-ink-4">
                        <Sparkles className="size-3.5 text-brand" /> AI summary · {formatShortDate(m.started_at)}
                      </div>
                      <p className="mt-1.5 text-[15px] font-medium text-ink">{m.title}</p>
                      <p className="mt-1 line-clamp-2 text-[14px] text-ink-3">{m.overview}</p>
                      <p className="mt-2 text-xs text-ink-4">
                        {m.action_items_open} open action item{m.action_items_open === 1 ? "" : "s"}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="mt-16">
            <h2 className="text-[22px] font-semibold tracking-tight text-ink">Try More</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-surface p-5">
                <Monitor className="size-7 text-[#6172f3]" strokeWidth={1.5} />
                <p className="mt-4 text-[16px] font-medium text-ink">Desktop App</p>
                <p className="mt-1 text-[15px] text-ink-3">Capture conversations without any bot present in your meeting.</p>
                <button
                  type="button"
                  onClick={() => comingSoon({ name: "Desktop App", description: "Record meetings from your Mac or Windows computer without a bot in the call." })}
                  className="mt-5 inline-flex h-11 items-center gap-2 rounded-md bg-brand px-4 text-[15px] font-medium text-white hover:bg-brand-hover"
                >
                  <Download className="size-4" /> Download
                </button>
              </div>
              <div className="rounded-xl border border-line bg-surface p-5">
                <Smartphone className="size-7 text-[#e04f7a]" strokeWidth={1.5} />
                <p className="mt-4 text-[16px] font-medium text-ink">Mobile App</p>
                <p className="mt-1 text-[15px] text-ink-3">Record in-person conversations and review meetings on the go.</p>
                <div className="mt-5 flex gap-2">
                  {[
                    { label: "App Store", icon: <AppStoreIcon /> },
                    { label: "Google Play", icon: <PlayStoreIcon /> },
                  ].map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      aria-label={s.label}
                      onClick={() => comingSoon({ name: "Mobile App", description: `Fireflies for ${s.label === "App Store" ? "iOS" : "Android"} records in-person conversations.` })}
                      className="flex size-11 items-center justify-center rounded-md border border-line bg-subtle hover:border-line-strong"
                    >
                      {s.icon}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
