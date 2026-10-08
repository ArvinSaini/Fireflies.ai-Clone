"use client";

import {
  ArrowUp, CalendarDays, CalendarPlus, ChevronRight, ListChecks, MessageSquare, Plus, Rss, Settings2,
  Sparkles, Upload,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { useCreateMeeting } from "@/components/meetings/CreateMeetingModal";
import { useComingSoon } from "@/components/providers/ComingSoonProvider";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState, Segmented, Skeleton, Switch } from "@/components/ui/Primitives";
import { firstName, formatDuration, formatShortDate, formatTime, greeting } from "@/lib/format";
import { useMe, useMeetings, useStats } from "@/lib/queries";

type Tab = "recent" | "upcoming" | "feed";

function AssistantCard({
  icon, iconBg, title, children, onClick, href,
}: { icon: React.ReactNode; iconBg: string; title: React.ReactNode; children: React.ReactNode; onClick?: () => void; href?: string }) {
  const cls = "block rounded-xl border border-line bg-surface p-5 text-left shadow-xs transition-shadow hover:shadow-pop";
  const body = (
    <>
      <span className={`flex size-9 items-center justify-center rounded-lg text-white ${iconBg}`}>{icon}</span>
      <p className="mt-5 text-[15px] font-medium text-ink">{title}</p>
      <p className="mt-0.5 text-[14px] text-ink-4">{children}</p>
    </>
  );
  return href ? <Link href={href} className={cls}>{body}</Link> : <button type="button" onClick={onClick} className={cls}>{body}</button>;
}

export function HomeView() {
  const router = useRouter();
  const comingSoon = useComingSoon();
  const createMeeting = useCreateMeeting();
  const { data: me } = useMe();
  const { data: stats } = useStats();
  const { data: recent, isLoading } = useMeetings({ page_size: 8 });
  const [tab, setTab] = useState<Tab>("recent");
  const [assistant, setAssistant] = useState(true);
  const [ask, setAsk] = useState("");
  const [hello, setHello] = useState<{ text: string; emoji: string } | null>(null);
  useEffect(() => setHello(greeting()), []); // client clock only (avoids SSR mismatch)

  const submitAsk = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/askfred${ask.trim() ? `?q=${encodeURIComponent(ask.trim())}` : ""}`);
  };

  return (
    <>
      <Topbar title="Home" />
      <main className="hero-wash relative flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1000px] px-6 pt-10 pb-36">
          <div className="flex items-center justify-between">
            <h1 className="text-[28px] font-medium tracking-tight text-ink">
              {hello?.text ?? "Hello"}, {me ? firstName(me.name) : ""} <span className="text-2xl">{hello?.emoji}</span>
            </h1>
            <button onClick={() => comingSoon("Feedback")} className="flex items-center gap-1.5 text-[14px] text-ink-3 hover:text-ink">
              <MessageSquare className="size-4" /> Feedback
            </button>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <span className="flex items-center gap-2 text-[14px] text-ink-3">
              <Sparkles className="size-4" /> Personal Assistant
            </span>
            <Switch checked={assistant} onChange={setAssistant} label="Personal Assistant" />
          </div>

          {assistant && (
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <AssistantCard icon={<Rss className="size-5" />} iconBg="bg-[#a4bcfd]" title={<span className="text-ink-4">Daily Digest <span className="text-xs">▶ Listen (OFF)</span></span>}
                onClick={() => comingSoon({ name: "Daily Digest", description: "A spoken briefing of yesterday's meetings, decisions and your tasks." })}>
                <span className="text-brand">Enable</span> to view it.
              </AssistantCard>
              <AssistantCard icon={<CalendarDays className="size-5" />} iconBg="bg-[#fd853a]" title="Meeting Prep"
                onClick={() => comingSoon({ name: "Meeting Prep", description: "Connect your calendar and Fred prepares a brief before each meeting." })}>
                No upcoming meetings
              </AssistantCard>
              <AssistantCard icon={<ListChecks className="size-5" />} iconBg="bg-[#66c61c]" title="Tasks" href="/tasks">
                {stats ? `${stats.action_items_open} open tasks` : "…"}
              </AssistantCard>
            </div>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Schedule Meeting", icon: <CalendarPlus className="size-4 text-[#ee46bc]" />, bg: "bg-[#fdf2fa] dark:bg-[#3a1730]", onClick: () => comingSoon("Calendar scheduling") },
              { label: "Upload File", icon: <Upload className="size-4 text-[#16b364]" />, bg: "bg-[#edfcf2] dark:bg-[#0f2a1d]", onClick: () => createMeeting("upload") },
              { label: "Paste Transcript", icon: <Plus className="size-4 text-brand" />, bg: "bg-brand-soft", onClick: () => createMeeting("paste") },
            ].map((q) => (
              <button key={q.label} onClick={q.onClick} className={`flex items-center gap-3 rounded-xl px-4 py-3.5 text-[14px] text-ink-2 transition-opacity hover:opacity-80 ${q.bg}`}>
                {q.icon}
                <span className="flex-1 text-left">{q.label}</span>
                <ChevronRight className="size-4 text-ink-4" />
              </button>
            ))}
          </div>

          <div className="mt-8 flex items-center justify-between">
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
            <button onClick={() => comingSoon("Home feed settings")} className="flex items-center gap-1.5 text-[14px] text-ink-3 hover:text-ink">
              <Settings2 className="size-4" /> Settings
            </button>
          </div>

          <div className="mt-3">
            {tab === "recent" && (
              <div className="divide-y divide-line/0">
                {isLoading && Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="my-4 h-10" />)}
                {recent?.items.map((m) => (
                  <Link key={m.id} href={`/meetings/${m.id}`} className="-mx-3 flex items-center gap-3.5 rounded-xl px-3 py-3 hover:bg-surface/70">
                    <Avatar name={m.host?.name ?? m.title} size="md" className="size-9" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium text-ink">{m.title}</span>
                      <span className="text-[14px] text-ink-4">
                        {formatShortDate(m.started_at)} · {formatTime(m.started_at)}
                      </span>
                    </span>
                    <span className="hidden text-[13px] text-ink-4 sm:block">{formatDuration(m.duration_ms)}</span>
                  </Link>
                ))}
                {!isLoading && !recent?.items.length && (
                  <EmptyState icon={<Upload />} title="No meetings yet" description="Upload or paste a transcript to see Fireflies in action." />
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
        </div>

        <form onSubmit={submitAsk} className="pointer-events-none sticky bottom-6 mx-auto flex max-w-[740px] px-6">
          <div className="pointer-events-auto flex w-full items-center gap-2 rounded-2xl border border-line bg-surface py-2 pr-2 pl-5 shadow-pop">
            <input
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              placeholder="Ask anything about your meetings…"
              className="h-10 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-5"
            />
            <button type="submit" aria-label="Ask Fred" className="flex size-9 items-center justify-center rounded-lg bg-brand-200 text-white hover:bg-brand">
              <ArrowUp className="size-4" />
            </button>
          </div>
        </form>
      </main>
    </>
  );
}

