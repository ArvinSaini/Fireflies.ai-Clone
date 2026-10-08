"use client";
// Right-hand "Ask Fred" panel of the Meetings page (as in the real Notebook): ask across your meetings.
import { ArrowUp, Hash, Layers, Mic, MessageSquarePlus, Plus, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AnswerSources, type WorkspaceTurn } from "@/components/askfred/AnswerSources";
import { AnswerText } from "@/components/notepad/AskFredPanel";
import { useComingSoon } from "@/components/providers/ComingSoonProvider";
import { api } from "@/lib/api";
import { firstName } from "@/lib/format";
import { useIsClient } from "@/lib/hooks";
import { errorToast, useMe } from "@/lib/queries";

const CHIPS = [
  { label: "My action items", icon: "✅", question: "What are my open action items?" },
  { label: "Key decisions", icon: "🎯", question: "What key decisions were made in my meetings?" },
  { label: "Key initiatives", icon: "📌", question: "What are the key initiatives across my meetings?" },
];

export function LibraryAskFred({ scope }: { scope: string }) {
  const comingSoon = useComingSoon();
  const isClient = useIsClient();
  const { data: me } = useMe();
  const [turns, setTurns] = useState<WorkspaceTurn[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [showConnect, setShowConnect] = useState(true);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [turns.length, pending]);

  const ask = async (q: string) => {
    const question = q.trim();
    if (!question || pending) return;
    setInput("");
    const history = turns.slice(-6).map(({ role, content }) => ({ role, content }));
    setTurns((t) => [...t, { role: "user", content: question }]);
    setPending(true);
    try {
      const data = await api.askWorkspace(question, history);
      setTurns((t) => [...t, { role: "assistant", content: data.answer, data }]);
    } catch (e) {
      errorToast(e);
    } finally {
      setPending(false);
    }
  };

  return (
    <aside className="hidden w-[380px] shrink-0 flex-col border-l border-line bg-surface xl:flex" aria-label="Ask Fred">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-4">
        <span className="flex size-6 items-center justify-center rounded-md bg-brand-soft text-[13px]">🤖</span>
        <span className="flex-1 text-[15px] text-ink-2">Ask Fred</span>
        <button onClick={() => setTurns([])} title="New chat" aria-label="New chat" className="rounded-md p-1.5 text-ink-4 hover:bg-muted hover:text-ink">
          <MessageSquarePlus className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {showConnect && (
          <div className="relative mb-6 rounded-xl bg-brand-soft p-4">
            <button onClick={() => setShowConnect(false)} aria-label="Dismiss" className="absolute top-2 right-2 rounded p-1 text-ink-4 hover:text-ink">
              <X className="size-3.5" />
            </button>
            <p className="pr-5 text-[13px] text-ink-3"><b className="font-semibold text-ink">Connect Slack and Gmail</b> — get answers with full context.</p>
            <button onClick={() => comingSoon("Slack & Gmail connectors")} className="mt-2 block w-full text-right text-[13px] font-medium text-brand">Connect</button>
          </div>
        )}

        {turns.length === 0 && !pending ? (
          <div className="pt-6">
            <Sparkles className="size-7 text-[#47cd89]" />
            <p className="mt-5 text-[18px] text-ink">Hi {isClient && me ? firstName(me.name) : "there"}!</p>
            <p className="text-[18px] text-ink">Get ready for your meeting</p>
            <div className="mt-8 space-y-2.5">
              {CHIPS.map((c) => (
                <button key={c.label} onClick={() => ask(c.question)}
                  className="flex items-center gap-2.5 rounded-lg bg-subtle px-3 py-2 text-[14px] text-ink-2 hover:bg-muted">
                  <span>{c.icon}</span> {c.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {turns.map((t, i) =>
              t.role === "user" ? (
                <p key={i} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-muted px-3.5 py-2 text-[13px] text-ink">{t.content}</p>
              ) : (
                <div key={i} className="text-[13px] leading-relaxed text-ink-2">
                  <p className="mb-1 flex items-center gap-1 text-xs text-ink-4"><Sparkles className="size-3 text-brand" /> Fred</p>
                  <AnswerText text={t.content} />
                  <AnswerSources data={t.data} compact />
                </div>
              ),
            )}
            {pending && <p className="text-[13px] text-ink-4">Fred is looking through your meetings…</p>}
            <div ref={bottom} />
          </div>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void ask(input); }} className="m-3 rounded-xl border border-line-strong bg-surface p-3 focus-within:border-brand-400">
        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-ink-3"><Hash className="size-3" />{scope}</span>
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(input); } }}
          placeholder="Ask anything. Type / to run AI skills."
          aria-label="Ask Fred about your meetings"
          className="mt-2 w-full resize-none bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-5"
        />
        <div className="flex items-center gap-1 text-ink-4">
          <button type="button" onClick={() => comingSoon("Attach files")} aria-label="Attach" className="rounded p-1 hover:bg-muted"><Plus className="size-4" /></button>
          <button type="button" onClick={() => comingSoon("Connectors")} aria-label="Connectors" className="rounded p-1 hover:bg-muted"><Layers className="size-4" /></button>
          <button type="button" onClick={() => comingSoon("Voice input")} aria-label="Voice input" className="ml-auto rounded p-1 hover:bg-muted"><Mic className="size-4" /></button>
          <button type="submit" disabled={!input.trim() || pending} aria-label="Send"
            className="flex size-7 items-center justify-center rounded-md bg-brand text-white disabled:bg-brand-200"><ArrowUp className="size-4" /></button>
        </div>
      </form>
    </aside>
  );
}
