"use client";

import { ArrowDownUp, FolderInput, Hash, Lock, MessageSquare, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/Topbar";
import { useComingSoon } from "@/components/providers/ComingSoonProvider";
import { Button } from "@/components/ui/Button";
import { MenuItem, Popover } from "@/components/ui/Popover";
import { Checkbox, EmptyState, Input, Segmented, Skeleton } from "@/components/ui/Primitives";
import { api } from "@/lib/api";
import { dayKey, formatDayHeader } from "@/lib/format";
import { useDebounced } from "@/lib/hooks";
import { errorToast, useChannels, useInvalidateLibrary, useMeetings, useParticipants } from "@/lib/queries";
import type { MeetingFilters, MeetingListItem } from "@/lib/types";
import { useCreateMeeting } from "./CreateMeetingModal";
import {
  DATE_PRESETS, DURATION_PRESETS, EMPTY_FILTERS, FiltersPopover, toQuery, type LibraryFilters,
} from "./FiltersPopover";
import { LibraryAskFred } from "./LibraryAskFred";
import { MeetingCard } from "./MeetingCard";
import { ConfirmDialog, MeetingDetailsDrawer, MoveToChannelDialog } from "./MeetingDialogs";
import { PLATFORMS } from "./PlatformIcon";

const PAGE = 20;
type Sort = NonNullable<MeetingFilters["sort"]>;
const SORTS: { value: Sort; label: string }[] = [
  { value: "recent", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "longest", label: "Longest first" },
  { value: "shortest", label: "Shortest first" },
  { value: "title", label: "Title A–Z" },
];

function Chip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface py-1 pr-1.5 pl-2.5 text-xs text-ink-2">
      {children}
      <button onClick={onRemove} aria-label="Remove filter" className="rounded-full p-0.5 text-ink-4 hover:bg-muted hover:text-ink"><X className="size-3" /></button>
    </span>
  );
}

/** Reads the URL; keying the library by view/channel resets its local state when you switch. */
export function MeetingsView() {
  const params = useSearchParams();
  const view = params.get("view") === "all" ? "all" : "mine";
  const channelId = Number(params.get("channel")) || null;
  return <Library key={`${view}-${channelId}`} view={view} channelId={channelId} initialQuery={params.get("q") ?? ""} />;
}

function Library({ view, channelId, initialQuery }: { view: "all" | "mine"; channelId: number | null; initialQuery: string }) {
  const comingSoon = useComingSoon();
  const createMeeting = useCreateMeeting();
  const invalidate = useInvalidateLibrary();
  const { data: channels } = useChannels();
  const { data: people } = useParticipants();

  const channel = channels?.find((c) => c.id === channelId);

  const [scope, setScope] = useState<"mine" | "shared" | null>(null);
  const [filters, setFilters] = useState<LibraryFilters>(EMPTY_FILTERS);
  const [searchOpen, setSearchOpen] = useState(!!initialQuery);
  const [q, setQ] = useState(initialQuery);
  const [sort, setSort] = useState<Sort>("recent");
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [details, setDetails] = useState<MeetingListItem | null>(null);
  const [bulk, setBulk] = useState<"move" | "delete" | null>(null);
  const debouncedQ = useDebounced(q.trim(), 250);

  // New filters → back to the first page with nothing selected (reset during render, not in an effect).
  const resetKey = JSON.stringify([scope, filters, debouncedQ, sort]);
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setLimit(PAGE);
    setSelected(new Set());
  }

  const query: MeetingFilters = useMemo(() => {
    const base = toQuery(filters);
    return {
      ...base,
      q: debouncedQ || undefined,
      scope: scope ?? "all",
      channel_id: channelId ? [channelId, ...base.channel_id] : base.channel_id,
      sort,
      page: 1,
      page_size: limit,
    };
  }, [filters, debouncedQ, scope, channelId, sort, limit]);
  const { data, isLoading, isFetching } = useMeetings(query);
  const items = useMemo(() => data?.items ?? [], [data]);

  const groups = useMemo(() => {
    const out: { key: string; label: string; items: MeetingListItem[] }[] = [];
    for (const m of items) {
      const key = dayKey(m.started_at);
      const last = out[out.length - 1];
      if (last?.key === key && sort !== "title" && sort !== "longest" && sort !== "shortest") last.items.push(m);
      else out.push({ key: `${key}-${out.length}`, label: formatDayHeader(m.started_at), items: [m] });
    }
    return out;
  }, [items, sort]);

  const toggle = (ids: number[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });

  const bulkDelete = async () => {
    try {
      const { affected } = await api.bulk({ action: "delete", meeting_ids: [...selected] });
      toast.success(`Deleted ${affected} meeting${affected === 1 ? "" : "s"}`);
      setSelected(new Set());
      setBulk(null);
      await invalidate();
    } catch (e) {
      errorToast(e);
    }
  };

  const personName = (id: number) => people?.find((p) => p.id === id)?.name ?? `#${id}`;
  const chips: { key: string; label: string; remove: () => void }[] = [
    ...filters.hostIds.map((id) => ({ key: `h${id}`, label: `Host: ${personName(id)}`, remove: () => setFilters({ ...filters, hostIds: filters.hostIds.filter((x) => x !== id) }) })),
    ...filters.participantIds.map((id) => ({ key: `p${id}`, label: personName(id), remove: () => setFilters({ ...filters, participantIds: filters.participantIds.filter((x) => x !== id) }) })),
    ...filters.channelIds.map((id) => ({ key: `c${id}`, label: `#${channels?.find((c) => c.id === id)?.name ?? id}`, remove: () => setFilters({ ...filters, channelIds: filters.channelIds.filter((x) => x !== id) }) })),
    ...filters.platforms.map((p) => ({ key: `f${p}`, label: PLATFORMS.find((x) => x.value === p)?.label ?? p, remove: () => setFilters({ ...filters, platforms: filters.platforms.filter((x) => x !== p) }) })),
    ...(filters.date !== "any" ? [{ key: "date", label: DATE_PRESETS.find((d) => d.value === filters.date)!.label, remove: () => setFilters({ ...filters, date: "any" }) }] : []),
    ...(filters.duration !== "any" ? [{ key: "dur", label: DURATION_PRESETS.find((d) => d.value === filters.duration)!.label, remove: () => setFilters({ ...filters, duration: "any" }) }] : []),
  ];

  const title = channel ? (
    <span className="inline-flex items-center gap-1">{channel.is_private ? <Lock className="size-4" /> : <Hash className="size-4" />}{channel.name}</span>
  ) : view === "all" ? "All Meetings" : "My Meetings";

  return (
    <>
      <Topbar title="Meetings" />
      <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col bg-surface">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-6 py-4">
          {channel ? (
            <h1 className="mr-auto text-[16px] font-medium text-ink">{title}</h1>
          ) : (
            <>
              {view === "mine" && (
                <Segmented<"mine" | "shared">
                  value={scope}
                  onChange={(v) => setScope(scope === v ? null : v)}
                  options={[{ value: "mine", label: "Hosted by me" }, { value: "shared", label: "Shared with me" }]}
                />
              )}
              {view === "mine" && <span className="h-6 w-px bg-line" />}
            </>
          )}
          <FiltersPopover value={filters} onChange={setFilters} />
          <Popover
            trigger={({ toggle: t }) => (
              <Button onClick={t} className="h-9" aria-label="Sort">
                <ArrowDownUp className="size-4" /> {SORTS.find((s) => s.value === sort)!.label}
              </Button>
            )}
          >
            {(close) => SORTS.map((s) => (
              <MenuItem key={s.value} onClick={() => { setSort(s.value); close(); }} badge={s.value === sort ? <span className="text-brand">✓</span> : null}>
                {s.label}
              </MenuItem>
            ))}
          </Popover>
          <div className="ml-auto flex items-center gap-2">
            {channel && (
              <Button variant="primary" className="h-9" onClick={() => createMeeting("upload")}>
                <Plus className="size-4" /> Add Meetings
              </Button>
            )}
            {searchOpen ? (
              <div className="w-64">
                <Input autoFocus icon={<Search />} value={q} onChange={(e) => setQ(e.target.value)} className="h-9"
                  placeholder="Search title or participant" onBlur={() => !q && setSearchOpen(false)} />
              </div>
            ) : (
              <Button aria-label="Search meetings" className="h-9 w-9 px-0" onClick={() => setSearchOpen(true)}>
                <Search className="size-4" />
              </Button>
            )}
          </div>
        </div>

        {(chips.length > 0 || debouncedQ) && (
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-6 py-2.5">
            {debouncedQ && <Chip onRemove={() => setQ("")}>Search: “{debouncedQ}”</Chip>}
            {chips.map((c) => <Chip key={c.key} onRemove={c.remove}>{c.label}</Chip>)}
            <span className="text-xs text-ink-4">{data?.total ?? 0} meetings</span>
          </div>
        )}

        {selected.size > 0 && (
          <div className="flex items-center gap-3 border-b border-brand-200 bg-brand-soft px-6 py-2.5">
            <Checkbox checked={selected.size === items.length} indeterminate={selected.size < items.length}
              onChange={(on) => setSelected(on ? new Set(items.map((m) => m.id)) : new Set())} label="Select all" />
            <span className="text-[13px] font-medium text-brand-hover">{selected.size} selected</span>
            <Button size="xs" className="ml-2" onClick={() => setBulk("move")}><FolderInput className="size-3.5" /> Move</Button>
            <Button size="xs" className="text-danger" onClick={() => setBulk("delete")}><Trash2 className="size-3.5" /> Delete</Button>
            <button onClick={() => setSelected(new Set())} className="ml-auto text-[13px] text-ink-3 hover:text-ink">Clear selection</button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-10">
          {isLoading && Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="mt-5 h-[104px] rounded-xl" />)}
          {groups.map((g, gi) => {
            const ids = g.items.map((m) => m.id);
            const all = ids.every((id) => selected.has(id));
            return (
              <section key={g.key}>
                <div className="flex items-center gap-3 pt-6 pb-3">
                  <Checkbox checked={all} indeterminate={!all && ids.some((id) => selected.has(id))}
                    onChange={(on) => toggle(ids, on)} label={`Select meetings from ${g.label}`} />
                  <h2 className="text-[15px] text-ink-3">{g.label}</h2>
                  {gi === 0 && (
                    <button onClick={() => comingSoon("Feedback")} className="ml-auto flex items-center gap-1.5 text-[14px] text-ink-4 hover:text-ink-2">
                      <MessageSquare className="size-4" /> Feedback
                    </button>
                  )}
                </div>
                <div className="space-y-4">
                  {g.items.map((m) => (
                    <MeetingCard key={m.id} meeting={m} selected={selected.has(m.id)} selectionMode={selected.size > 0}
                      onSelect={(on) => toggle([m.id], on)} onDetails={() => setDetails(m)} />
                  ))}
                </div>
              </section>
            );
          })}

          {!isLoading && !items.length && (
            <EmptyState
              icon={channel ? <Hash /> : <Upload />}
              title={chips.length || debouncedQ ? "No meetings match your filters" : channel ? `#${channel.name} has no meetings yet` : "No meetings yet"}
              description={chips.length || debouncedQ ? "Try removing a filter or searching for something else." : "Upload or paste a transcript and Fireflies will generate notes, action items and an outline."}
              action={
                chips.length || debouncedQ ? (
                  <Button onClick={() => { setFilters(EMPTY_FILTERS); setQ(""); }}>Clear filters</Button>
                ) : (
                  <Button variant="primary" onClick={() => createMeeting("upload")}><Upload className="size-4" /> Upload a transcript</Button>
                )
              }
            />
          )}

          {items.length > 0 && (
            <div className="pt-8 text-center">
              {data && items.length < data.total ? (
                <Button disabled={isFetching} onClick={() => setLimit((l) => l + PAGE)}>
                  {isFetching ? "Loading…" : `Load more (${data.total - items.length} more)`}
                </Button>
              ) : (
                <p className="text-[14px] text-ink-4">You&apos;ve reached the end of your meetings.</p>
              )}
            </div>
          )}
        </div>
      </div>
      <LibraryAskFred scope={channel ? channel.name : view === "all" ? "All Meetings" : "My Meetings"} />
      </div>

      <MeetingDetailsDrawer meeting={details} onClose={() => setDetails(null)} />
      {bulk === "move" && (
        <MoveToChannelDialog meetingIds={[...selected]} open onClose={() => setBulk(null)} onMoved={() => setSelected(new Set())} />
      )}
      <ConfirmDialog
        open={bulk === "delete"}
        onClose={() => setBulk(null)}
        onConfirm={bulkDelete}
        title={`Delete ${selected.size} meeting${selected.size === 1 ? "" : "s"}?`}
        description="Their transcripts, notes and action items will be permanently deleted."
      />
    </>
  );
}
