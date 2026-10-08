"use client";

import { Bot, FileText, Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { formatShortDate, formatTimestamp } from "@/lib/format";
import { useDebounced, useHotkey } from "@/lib/hooks";
import { useSearch } from "@/lib/queries";
import type { SearchHit } from "@/lib/types";
import { cn } from "@/lib/utils";

const Ctx = createContext<{ open: (q?: string) => void }>({ open: () => {} });
export const useCommandPalette = () => useContext(Ctx);

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; q: string }>({ open: false, q: "" });
  const open = useCallback((q = "") => setState({ open: true, q }), []);
  useHotkey((e) => (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k", (e) => {
    e.preventDefault();
    open();
  }, { allowInInputs: true });
  return (
    <Ctx.Provider value={useMemo(() => ({ open }), [open])}>
      {children}
      {state.open && <Palette initial={state.q} onClose={() => setState({ open: false, q: "" })} />}
    </Ctx.Provider>
  );
}

function hitHref(hit: SearchHit) {
  return hit.start_ms != null ? `/meetings/${hit.meeting_id}?t=${hit.start_ms}` : `/meetings/${hit.meeting_id}`;
}

function Palette({ initial, onClose }: { initial: string; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const debounced = useDebounced(q.trim(), 200);
  const { data, isFetching } = useSearch(debounced);
  const [active, setActive] = useState(0);
  const hits = useMemo(() => (debounced.length > 1 ? data?.hits ?? [] : []), [data, debounced]);
  const titles = hits.filter((h) => h.kind === "title");
  const transcripts = hits.filter((h) => h.kind === "transcript");
  const ordered = [...titles, ...transcripts];

  const [prevQuery, setPrevQuery] = useState(debounced);
  if (prevQuery !== debounced) {
    setPrevQuery(debounced);
    setActive(0);
  }

  const go = (href: string) => {
    onClose();
    router.push(href);
  };
  const askFred = () => go(`/askfred${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, ordered.length)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    if (e.key === "Enter") {
      e.preventDefault();
      if (active < ordered.length) go(hitHref(ordered[active]!));
      else askFred();
    }
  };

  const renderHit = (hit: SearchHit) => {
    const index = ordered.indexOf(hit);
    return (
      <button
        key={`${hit.kind}-${hit.meeting_id}-${hit.segment_id}`}
        onMouseEnter={() => setActive(index)}
        onClick={() => go(hitHref(hit))}
        className={cn("flex w-full gap-3 rounded-lg px-3 py-2.5 text-left", index === active && "bg-muted")}
      >
        <Avatar name={hit.meeting_title} size="sm" className="mt-0.5" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-[14px] font-medium text-ink">{hit.meeting_title}</span>
            {hit.speaker && <span className="shrink-0 text-xs text-ink-4">· {hit.speaker}</span>}
            {hit.start_ms != null && <span className="shrink-0 text-xs text-link">{formatTimestamp(hit.start_ms)}</span>}
            <span className="ml-auto shrink-0 text-xs text-ink-4">{formatShortDate(hit.meeting_started_at)}</span>
          </span>
          {hit.kind === "transcript" && (
            // Snippet HTML is escaped server-side; only <mark> tags are inserted.
            <span className="mt-1 line-clamp-2 block text-[13px] text-ink-3" dangerouslySetInnerHTML={{ __html: hit.snippet }} />
          )}
        </span>
      </button>
    );
  };

  return (
    <Modal open onClose={onClose} bare size="lg">
      <div onKeyDown={onKeyDown}>
        <div className="flex items-center gap-3 border-b border-line px-5">
          <Search className="size-5 text-ink-5" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search meetings and transcripts…"
            className="h-14 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-5"
          />
          {isFetching && <Loader2 className="size-4 animate-spin text-ink-5" />}
          {q && <button onClick={() => setQ("")} className="text-[13px] text-ink-4 hover:text-ink">Clear</button>}
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-2">
          {debounced.length > 1 && (
            <div className="flex items-center gap-2 px-3 py-2 text-[13px] text-ink-3">
              <Search className="size-4" /> Search &ldquo;{debounced}&rdquo;
              <span className="ml-auto text-xs text-ink-4">{hits.length} results</span>
            </div>
          )}
          {titles.length > 0 && <p className="px-3 pt-2 pb-1 text-xs font-medium text-ink-4">Meetings</p>}
          {titles.map(renderHit)}
          {transcripts.length > 0 && <p className="px-3 pt-3 pb-1 text-xs font-medium text-ink-4">Transcripts</p>}
          {transcripts.map(renderHit)}
          {debounced.length > 1 && !hits.length && !isFetching && (
            <div className="flex flex-col items-center py-10 text-center text-ink-4">
              <FileText className="mb-2 size-6" />
              <p className="text-[13px]">No meetings or transcript lines match &ldquo;{debounced}&rdquo;</p>
            </div>
          )}
          {debounced.length <= 1 && (
            <p className="px-3 py-8 text-center text-[13px] text-ink-5">Type to search across every meeting title and transcript.</p>
          )}
        </div>
        <button
          onClick={askFred}
          onMouseEnter={() => setActive(ordered.length)}
          className={cn(
            "m-2 mt-0 flex w-[calc(100%-1rem)] items-center gap-3 rounded-lg bg-brand-soft px-4 py-3 text-left",
            active === ordered.length && "ring-2 ring-brand-200",
          )}
        >
          <Bot className="size-5 text-brand" />
          <span className="flex-1 text-[13px] text-ink-2">Ask Fred anything about your meetings</span>
          <span className="text-[13px] font-semibold text-brand">Try AskFred</span>
        </button>
      </div>
    </Modal>
  );
}
