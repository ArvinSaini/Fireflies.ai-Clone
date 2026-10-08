"use client";

import { CalendarDays, Clock3, Hash, ListFilter, Mic, Search, User, Users } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Popover } from "@/components/ui/Popover";
import { Checkbox, Input } from "@/components/ui/Primitives";
import { daysAgoISO } from "@/lib/format";
import { useChannels, useParticipants } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { PLATFORMS } from "./PlatformIcon";

export interface LibraryFilters {
  hostIds: number[];
  participantIds: number[];
  channelIds: number[];
  platforms: string[];
  date: DatePreset;
  dateFrom?: string;
  dateTo?: string;
  duration: DurationPreset;
}

export type DatePreset = "any" | "today" | "7" | "14" | "30" | "custom";
export type DurationPreset = "any" | "lt15" | "15-30" | "30-60" | "60-90" | "90+";

export const EMPTY_FILTERS: LibraryFilters = {
  hostIds: [], participantIds: [], channelIds: [], platforms: [], date: "any", duration: "any",
};

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "any", label: "Any Time" },
  { value: "today", label: "Today" },
  { value: "7", label: "Last 7 Days" },
  { value: "14", label: "Last 14 Days" },
  { value: "30", label: "Last 30 Days" },
  { value: "custom", label: "Custom" },
];

export const DURATION_PRESETS: { value: DurationPreset; label: string; min?: number; max?: number }[] = [
  { value: "any", label: "Any duration" },
  { value: "lt15", label: "Less than 15 mins", max: 15 },
  { value: "15-30", label: "15 - 30 mins", min: 15, max: 30 },
  { value: "30-60", label: "30 - 60 mins", min: 30, max: 60 },
  { value: "60-90", label: "60 - 90 mins", min: 60, max: 90 },
  { value: "90+", label: "90+ mins", min: 90 },
];

/** Translate UI filter state into API query params. */
export function toQuery(f: LibraryFilters) {
  const dur = DURATION_PRESETS.find((d) => d.value === f.duration);
  let date_from: string | undefined;
  let date_to: string | undefined;
  if (f.date === "today") date_from = daysAgoISO(0);
  else if (["7", "14", "30"].includes(f.date)) date_from = daysAgoISO(Number(f.date));
  else if (f.date === "custom") ({ dateFrom: date_from, dateTo: date_to } = f);
  return {
    host_id: f.hostIds, participant_id: f.participantIds, channel_id: f.channelIds, platform: f.platforms,
    date_from, date_to, min_duration: dur?.min, max_duration: dur?.max,
  };
}

export const activeFilterCount = (f: LibraryFilters) =>
  f.hostIds.length + f.participantIds.length + f.channelIds.length + f.platforms.length +
  (f.date !== "any" ? 1 : 0) + (f.duration !== "any" ? 1 : 0);

type Category = "host" | "participants" | "date" | "duration" | "captured" | "channels";

const CATEGORIES: { value: Category; label: string; icon: React.ReactNode }[] = [
  { value: "host", label: "Hosted by", icon: <User /> },
  { value: "participants", label: "Participants", icon: <Users /> },
  { value: "date", label: "Date Range", icon: <CalendarDays /> },
  { value: "duration", label: "Duration", icon: <Clock3 /> },
  { value: "captured", label: "Captured From", icon: <Mic /> },
  { value: "channels", label: "Channels", icon: <Hash /> },
];

function OptionRow({ checked, onToggle, children, radio }: { checked: boolean; onToggle: () => void; children: React.ReactNode; radio?: boolean }) {
  return (
    <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted">
      <span className="flex min-w-0 flex-1 items-center gap-2.5">{children}</span>
      {radio ? (
        <span className={cn("flex size-4 items-center justify-center rounded-full border", checked ? "border-brand" : "border-line-strong")}>
          {checked && <span className="size-2 rounded-full bg-brand" />}
        </span>
      ) : (
        <Checkbox checked={checked} decorative />
      )}
    </button>
  );
}

const toggle = (list: number[] | string[], v: number | string) =>
  (list as (number | string)[]).includes(v) ? (list as (number | string)[]).filter((x) => x !== v) : [...list, v];

export function FiltersPopover({ value, onChange }: { value: LibraryFilters; onChange: (f: LibraryFilters) => void }) {
  const [cat, setCat] = useState<Category>("host");
  const [search, setSearch] = useState("");
  const { data: hosts } = useParticipants("host");
  const { data: people } = useParticipants();
  const { data: channels } = useChannels();
  const count = activeFilterCount(value);
  const s = search.toLowerCase();

  const personList = (list: typeof people, key: "hostIds" | "participantIds") =>
    list
      ?.filter((p) => p.name.toLowerCase().includes(s) || p.email?.toLowerCase().includes(s))
      .map((p) => (
        <OptionRow key={p.id} checked={value[key].includes(p.id)} onToggle={() => onChange({ ...value, [key]: toggle(value[key], p.id) as number[] })}>
          <Avatar name={p.name} color={p.color} size="md" />
          <span className="min-w-0">
            <span className="block truncate text-[13px] text-ink">{p.name}</span>
            <span className="block truncate text-xs text-ink-4">{p.email ?? `${p.meeting_count} meetings`}</span>
          </span>
        </OptionRow>
      ));

  return (
    <Popover
      className="w-[580px] p-0"
      trigger={({ toggle: open }) => (
        <button
          type="button"
          onClick={open}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-lg border px-3.5 text-[13px] font-medium shadow-xs",
            count ? "border-brand-200 bg-brand-soft text-brand-hover" : "border-line-strong bg-surface text-ink-2 hover:bg-subtle",
          )}
        >
          <ListFilter className="size-4" /> Filters
          {count > 0 && <span className="rounded-full bg-brand px-1.5 text-[11px] text-white">{count}</span>}
        </button>
      )}
    >
      <div className="flex h-[380px]">
        <div className="flex w-48 shrink-0 flex-col border-r border-line p-2">
          {CATEGORIES.map((c) => (
            <button key={c.value} type="button" onClick={() => { setCat(c.value); setSearch(""); }}
              className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] [&_svg]:size-4",
                cat === c.value ? "bg-brand-soft text-brand-hover" : "text-ink-3 hover:bg-muted")}>
              {c.icon}{c.label}
            </button>
          ))}
          <button type="button" disabled={!count} onClick={() => onChange(EMPTY_FILTERS)}
            className="mt-auto rounded-lg border border-line px-3 py-2 text-[13px] text-ink-3 hover:bg-muted disabled:opacity-40">
            Clear All Filters
          </button>
        </div>
        <div className="flex min-w-0 flex-1 flex-col p-3">
          {(cat === "host" || cat === "participants" || cat === "channels") && (
            <div className="mb-2 flex items-center gap-2">
              <Input icon={<Search />} value={search} onChange={(e) => setSearch(e.target.value)} className="h-9"
                placeholder={cat === "host" ? "Search host" : cat === "channels" ? "Search channels" : "Search by name or email"} />
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {cat === "host" && personList(hosts, "hostIds")}
            {cat === "participants" && personList(people, "participantIds")}
            {cat === "channels" &&
              channels?.filter((c) => c.name.toLowerCase().includes(s)).map((c) => (
                <OptionRow key={c.id} checked={value.channelIds.includes(c.id)} onToggle={() => onChange({ ...value, channelIds: toggle(value.channelIds, c.id) as number[] })}>
                  <Hash className="size-4 text-ink-4" /><span className="text-[13px] text-ink-2">{c.name}</span>
                </OptionRow>
              ))}
            {cat === "captured" &&
              PLATFORMS.map((p) => (
                <OptionRow key={p.value} checked={value.platforms.includes(p.value)} onToggle={() => onChange({ ...value, platforms: toggle(value.platforms, p.value) as string[] })}>
                  <span className="text-[13px] text-ink-2">{p.label}</span>
                </OptionRow>
              ))}
            {cat === "duration" &&
              DURATION_PRESETS.map((d) => (
                <OptionRow key={d.value} radio checked={value.duration === d.value} onToggle={() => onChange({ ...value, duration: d.value })}>
                  <span className="text-[13px] text-ink-2">{d.label}</span>
                </OptionRow>
              ))}
            {cat === "date" && (
              <>
                {DATE_PRESETS.map((d) => (
                  <OptionRow key={d.value} radio checked={value.date === d.value} onToggle={() => onChange({ ...value, date: d.value })}>
                    <span className="text-[13px] text-ink-2">{d.label}</span>
                  </OptionRow>
                ))}
                {value.date === "custom" && (
                  <div className="mt-2 grid grid-cols-2 gap-2 px-2">
                    <Input type="date" aria-label="From" value={value.dateFrom ?? ""} onChange={(e) => onChange({ ...value, dateFrom: e.target.value })} className="h-9" />
                    <Input type="date" aria-label="To" value={value.dateTo ?? ""} onChange={(e) => onChange({ ...value, dateTo: e.target.value })} className="h-9" />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Popover>
  );
}
