"use client";

import { ArrowUp, Copy, Layers, MessageSquarePlus, Search, Sparkles, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/Topbar";
import { AnswerText } from "@/components/notepad/AskFredPanel";
import { useComingSoon } from "@/components/providers/ComingSoonProvider";
import { api } from "@/lib/api";
import { firstName, formatShortDate, formatTimestamp } from "@/lib/format";
import { useIsClient } from "@/lib/hooks";
import { errorToast, useMe } from "@/lib/queries";
import type { WorkspaceAnswer } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Turn {
  role: "user" | "assistant";
  content: string;
  data?: WorkspaceAnswer;
}
interface Conversation {
  id: string;
  title: string;
  updatedAt: number;
  turns: Turn[];
}

const STORAGE_KEY = "askfred.conversations";
const SUGGESTIONS = [
  "What are my open action items?",
  "Recap my meetings from this week",
  "What did customers say about SSO?",
  "What was decided about pricing?",
];

/** Recent conversations live in localStorage: a per-browser convenience, like a chat sidebar. */
function load(): Conversation[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function persist(list: Conversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 30)));
  } catch {
    /* storage unavailable (private mode) — keep in memory only */
  }
}

function bucket(ts: number): string {
  const days = (Date.now() - ts) / 86_400_000;
  return days < 1 ? "Today" : days < 7 ? "Last 7 Days" : "Last 30 Days";
}

export function AskFredView() {
  const params = useSearchParams();
  const comingSoon = useComingSoon();
  const { data: me } = useMe();
  const isClient = useIsClient(); // recents come from localStorage: render them only after hydration
  // Rendered client-side only (it sits behind useSearchParams + Suspense), so storage is available.
  const [conversations, setConversations] = useState<Conversation[]>(() => (typeof window === "undefined" ? [] : load()));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const autoAsked = useRef(false);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [active?.turns.length, pending]);

  const update = (fn: (list: Conversation[]) => Conversation[]) =>
    setConversations((prev) => {
      const next = fn(prev);
      persist(next);
      return next;
    });

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || pending) return;
    setInput("");
    const id = active?.id ?? crypto.randomUUID();
    const history = (active?.turns ?? []).slice(-6).map(({ role, content }) => ({ role, content }));
    update((list) => {
      const existing = list.find((c) => c.id === id);
      const convo: Conversation = existing
        ? { ...existing, updatedAt: Date.now(), turns: [...existing.turns, { role: "user", content: q }] }
        : { id, title: q.slice(0, 60), updatedAt: Date.now(), turns: [{ role: "user", content: q }] };
      return [convo, ...list.filter((c) => c.id !== id)];
    });
    setActiveId(id);
    setPending(true);
    try {
      const data = await api.askWorkspace(q, history);
      update((list) => list.map((c) => (c.id === id ? { ...c, turns: [...c.turns, { role: "assistant", content: data.answer, data }] } : c)));
    } catch (e) {
      errorToast(e);
    } finally {
      setPending(false);
    }
  };

  // ?q= from the Home "Ask anything" bar or the command palette (asked once).
  const askFromUrl = useEffectEvent((q: string) => void ask(q));
  useEffect(() => {
    const q = params.get("q");
    if (q && !autoAsked.current) {
      autoAsked.current = true;
      askFromUrl(q);
    }
  }, [params]);

  const groups = conversations.reduce<Record<string, Conversation[]>>((acc, c) => {
    (acc[bucket(c.updatedAt)] ??= []).push(c);
    return acc;
  }, {});

  return (
    <>
      <Topbar title="AskFred" />
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[260px] shrink-0 flex-col border-r border-line bg-surface p-3 lg:flex">
          <button onClick={() => setActiveId(null)} className="flex h-10 items-center gap-3 rounded-lg px-3 text-[14px] text-ink-2 hover:bg-muted">
            <MessageSquarePlus className="size-4 text-ink-4" /> New Chat
          </button>
          <button onClick={() => comingSoon("Search chats")} className="flex h-10 items-center gap-3 rounded-lg px-3 text-[14px] text-ink-2 hover:bg-muted">
            <Search className="size-4 text-ink-4" /> Search
          </button>
          <button onClick={() => comingSoon({ name: "Connectors", description: "Connect Gmail, Calendar, Slack and CRMs so Fred can answer with full context." })}
            className="flex h-10 items-center gap-3 rounded-lg px-3 text-[14px] text-ink-2 hover:bg-muted">
            <Layers className="size-4 text-ink-4" /> Connectors
          </button>
          <p className="mt-5 px-3 text-[14px] font-medium text-ink-2">Recents</p>
          <div className="mt-1 min-h-0 flex-1 overflow-y-auto">
            {isClient && Object.entries(groups).map(([label, list]) => (
              <div key={label} className="mt-3">
                <p className="px-3 pb-1 text-[13px] text-ink-5">{label}</p>
                {list.map((c) => (
                  <div key={c.id} className="group flex items-center">
                    <button onClick={() => setActiveId(c.id)}
                      className={cn("min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-left text-[14px]", c.id === activeId ? "bg-muted text-ink" : "text-ink-3 hover:bg-muted")}>
                      {c.title}
                    </button>
                    <button onClick={() => { update((l) => l.filter((x) => x.id !== c.id)); if (activeId === c.id) setActiveId(null); }}
                      aria-label="Delete chat" className="hidden rounded p-1 text-ink-5 group-hover:block hover:text-danger">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ))}
            {isClient && !conversations.length && <p className="px-3 py-2 text-[13px] text-ink-5">Your chats will appear here.</p>}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col bg-surface">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[760px] px-6 py-10">
              {!active ? (
                <div className="pt-[8vh]">
                  <Sparkles className="size-9 text-[#47cd89]" />
                  <h1 className="mt-6 text-[26px] text-ink">Hi {isClient && me ? firstName(me.name) : "there"}!</h1>
                  <p className="text-[26px] text-ink-3">Ask anything about your meetings</p>
                  <div className="mt-10 grid gap-3 sm:grid-cols-2">
                    {SUGGESTIONS.map((s, i) => (
                      <button key={s} onClick={() => ask(s)}
                        className="flex items-center gap-3 rounded-xl border border-line px-4 py-3.5 text-left text-[14px] text-ink-2 shadow-xs hover:bg-subtle">
                        <Sparkles className={cn("size-4 shrink-0", ["text-[#9b8afb]", "text-[#ee46bc]", "text-[#f38744]", "text-[#2e90fa]"][i])} /> {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  {active.turns.map((t, i) =>
                    t.role === "user" ? (
                      <div key={i} className="flex justify-end">
                        <p className="max-w-[80%] rounded-2xl rounded-br-md bg-muted px-4 py-2.5 text-[15px] text-ink">{t.content}</p>
                      </div>
                    ) : (
                      <div key={i} className="group text-[15px] leading-relaxed text-ink-2">
                        <p className="mb-2 flex items-center gap-1.5 text-xs text-ink-4"><Sparkles className="size-3.5 text-brand" /> Fred</p>
                        <AnswerText text={t.content} />
                        {!!t.data?.citations.length && (
                          <div className="mt-4 space-y-2">
                            <p className="text-xs font-medium text-ink-4">Sources</p>
                            {t.data.citations.map((c) => (
                              <Link key={c.segment_id} href={`/meetings/${c.meeting_id}?t=${c.start_ms}`}
                                className="block rounded-lg border border-line px-3 py-2 hover:border-brand-200 hover:bg-brand-soft/40">
                                <span className="text-[13px] font-medium text-ink">{c.meeting_title}</span>
                                <span className="ml-2 text-xs text-link">{formatTimestamp(c.start_ms)}</span>
                                <span className="ml-1 text-xs text-ink-4">· {c.speaker}</span>
                                <span className="mt-0.5 line-clamp-2 block text-[13px] text-ink-3">“{c.text}”</span>
                              </Link>
                            ))}
                          </div>
                        )}
                        {!t.data?.citations.length && !!t.data?.meetings.length && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {t.data.meetings.slice(0, 6).map((m) => (
                              <Link key={m.meeting_id} href={`/meetings/${m.meeting_id}`} className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-3 hover:text-brand">
                                {m.meeting_title} · {formatShortDate(m.started_at)}
                              </Link>
                            ))}
                          </div>
                        )}
                        <div className="mt-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button onClick={() => { void navigator.clipboard?.writeText(t.content); toast.success("Copied"); }} aria-label="Copy" className="rounded-md p-1.5 text-ink-4 hover:bg-muted"><Copy className="size-4" /></button>
                          <button onClick={() => toast.success("Thanks for the feedback!")} aria-label="Helpful" className="rounded-md p-1.5 text-ink-4 hover:bg-muted"><ThumbsUp className="size-4" /></button>
                          <button onClick={() => toast("Thanks — we'll use this to improve Fred.")} aria-label="Not helpful" className="rounded-md p-1.5 text-ink-4 hover:bg-muted"><ThumbsDown className="size-4" /></button>
                        </div>
                      </div>
                    ),
                  )}
                  {pending && (
                    <p className="flex items-center gap-1 text-[14px] text-ink-4">
                      <Sparkles className="size-4 text-brand" /> Searching your meetings
                      <span className="typing-dot">.</span><span className="typing-dot [animation-delay:.2s]">.</span><span className="typing-dot [animation-delay:.4s]">.</span>
                    </p>
                  )}
                  <div ref={bottom} />
                </div>
              )}
            </div>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); void ask(input); }} className="mx-auto w-full max-w-[800px] px-6 pb-6">
            <div className="flex items-end gap-2 rounded-2xl border border-line-strong bg-surface p-2.5 shadow-pop focus-within:border-brand-400">
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(input); } }}
                placeholder={active ? "Ask a follow-up question or anything…" : "Ask anything about your meetings…"}
                aria-label="Ask Fred"
                className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 text-[15px] text-ink outline-none placeholder:text-ink-5"
              />
              <button type="submit" disabled={!input.trim() || pending} aria-label="Send"
                className="flex size-10 items-center justify-center rounded-xl bg-brand text-white hover:bg-brand-hover disabled:bg-brand-200">
                <ArrowUp className="size-5" />
              </button>
            </div>
          </form>
        </main>
      </div>
    </>
  );
}
