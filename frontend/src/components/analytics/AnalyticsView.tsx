"use client";

import { BarChart3, Clock3, ListChecks, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Avatar } from "@/components/ui/Avatar";
import { Segmented, Skeleton } from "@/components/ui/Primitives";
import { formatDuration, parseDate } from "@/lib/format";
import { useIsClient } from "@/lib/hooks";
import { useMeetings, useParticipants, useStats } from "@/lib/queries";
import { ServerWaking } from "@/components/ui/ServerWaking";

function Tile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-xs">
      <div className="flex items-center gap-2 text-[13px] text-ink-4 [&_svg]:size-4">{icon}{label}</div>
      <p className="mt-3 text-[28px] font-semibold tracking-tight text-ink tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-[13px] text-ink-4">{sub}</p>}
    </div>
  );
}

/** Single-series vertical bar chart: thin bars, 4px rounded tops on the baseline, hover tooltip per bar. */
function BarChart({ data, label }: { data: { key: string; label: string; value: number; detail: string }[]; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const ticks = [...new Set([0, Math.ceil(max / 2), max])];
  return (
    <figure aria-label={label}>
      <div className="relative flex h-48 items-end gap-[2px] pl-8">
        {ticks.map((t) => (
          <div key={t} className="pointer-events-none absolute right-0 left-8 border-t border-line" style={{ bottom: `${(t / max) * 100}%` }}>
            <span className="absolute -top-2 -left-8 w-6 text-right text-[11px] text-ink-5 tabular-nums">{t}</span>
          </div>
        ))}
        {data.map((d, i) => (
          <div key={d.key} className="relative flex h-full flex-1 cursor-default items-end justify-center"
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <div className="w-full max-w-7 rounded-t bg-brand transition-opacity" style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 3 : 0, opacity: hover === null || hover === i ? 1 : 0.45 }} />
            {hover === i && (
              <div className="absolute bottom-full z-10 mb-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs whitespace-nowrap shadow-pop">
                <p className="font-medium text-ink">{d.detail}</p>
                <p className="text-ink-3">{d.value} meeting{d.value === 1 ? "" : "s"}</p>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-[2px] pl-8">
        {data.map((d, i) => (
          <span key={d.key} className="flex-1 text-center text-[11px] text-ink-5">{i % 2 === 0 ? d.label : ""}</span>
        ))}
      </div>
    </figure>
  );
}

export function AnalyticsView() {
  const { data: stats } = useStats();
  const { data: meetings, isLoading } = useMeetings({ page_size: 100 });
  const { data: people } = useParticipants();
  const [view, setView] = useState<"chart" | "table">("chart");
  const isClient = useIsClient();

  // "Last 14 days" depends on the viewer's clock, so it is only computed in the browser.
  const perDay = useMemo(() => {
    if (!isClient) return [];
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (13 - i));
      return d;
    });
    return days.map((d) => {
      const next = new Date(d);
      next.setDate(d.getDate() + 1);
      const count = (meetings?.items ?? []).filter((m) => { const t = parseDate(m.started_at); return t >= d && t < next; }).length;
      return {
        key: d.toISOString(),
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        detail: d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
        value: count,
      };
    });
  }, [meetings, isClient]);

  const topPeople = (people ?? []).slice(0, 6);
  const maxMeetings = Math.max(1, ...topPeople.map((p) => p.meeting_count));
  const hours = stats ? stats.total_duration_ms / 3_600_000 : 0;

  return (
    <>
      <Topbar title="Analytics" />
      <main className="flex-1 overflow-y-auto bg-subtle/40">
        <div className="mx-auto max-w-[1100px] space-y-6 px-6 py-8">
          <div>
            <h1 className="text-[22px] font-medium text-ink">Conversation analytics</h1>
            <p className="text-[14px] text-ink-4">How your team spends time in meetings.</p>
          </div>
          {!stats && <ServerWaking />}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats ? (
              <>
                <Tile icon={<BarChart3 />} label="Meetings" value={stats.meeting_count} sub={`${stats.meetings_this_week} in the last 7 days`} />
                <Tile icon={<Clock3 />} label="Time in meetings" value={hours >= 1 ? `${hours.toFixed(1)} h` : formatDuration(stats.total_duration_ms)} sub="Total recorded duration" />
                <Tile icon={<ListChecks />} label="Open action items" value={stats.action_items_open} sub={`of ${stats.action_items_total} captured`} />
                <Tile icon={<Users />} label="People" value={stats.participant_count} sub="Unique participants" />
              </>
            ) : (
              Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <section className="rounded-xl border border-line bg-surface p-5 shadow-xs">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-[15px] font-medium text-ink">Meetings per day</h2>
                  <p className="text-[13px] text-ink-4">Last 14 days</p>
                </div>
                <Segmented<"chart" | "table"> variant="pill" value={view} onChange={setView}
                  options={[{ value: "chart", label: "Chart" }, { value: "table", label: "Table" }]} />
              </div>
              {isLoading || !perDay.length ? <Skeleton className="h-52" /> : view === "chart" ? (
                <BarChart data={perDay} label="Meetings per day, last 14 days" />
              ) : (
                <table className="w-full text-[13px]">
                  <thead><tr className="text-left text-ink-4"><th className="pb-2 font-medium">Day</th><th className="pb-2 text-right font-medium">Meetings</th></tr></thead>
                  <tbody>{perDay.map((d) => <tr key={d.key} className="border-t border-line"><td className="py-1.5 text-ink-2">{d.detail}</td><td className="py-1.5 text-right text-ink tabular-nums">{d.value}</td></tr>)}</tbody>
                </table>
              )}
            </section>

            <section className="rounded-xl border border-line bg-surface p-5 shadow-xs">
              <h2 className="text-[15px] font-medium text-ink">Who you meet most</h2>
              <p className="mb-5 text-[13px] text-ink-4">Meetings attended together</p>
              <ul className="space-y-3.5">
                {topPeople.map((p) => (
                  <li key={p.id} className="flex items-center gap-3" title={`${p.name}: ${p.meeting_count} meetings`}>
                    <Avatar name={p.name} color={p.color} size="sm" />
                    <span className="w-32 truncate text-[13px] text-ink-2">{p.name}</span>
                    <span className="h-2 flex-1 rounded-full bg-muted">
                      <span className="block h-full rounded-full bg-brand" style={{ width: `${(p.meeting_count / maxMeetings) * 100}%` }} />
                    </span>
                    <span className="w-6 text-right text-[13px] text-ink tabular-nums">{p.meeting_count}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
