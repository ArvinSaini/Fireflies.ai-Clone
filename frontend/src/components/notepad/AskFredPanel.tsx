"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, Copy, Sparkles, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { firstName, formatTimestamp } from "@/lib/format";
import { errorToast, keys, useChat, useChatSuggestions, useMe } from "@/lib/queries";
import type { ChatMessage } from "@/lib/types";
import { useNotepad } from "./NotepadContext";
import { usePlayer } from "./PlayerContext";

const SPARKLE_COLORS = ["text-[#9b8afb]", "text-[#ee46bc]", "text-[#f38744]"];

/** Renders "• item" lines as a list and keeps other paragraphs as text. */
export function AnswerText({ text }: { text: string }) {
  const lines = text.split("\n").filter((l) => l.trim());
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) =>
        line.startsWith("• ") ? (
          <p key={i} className="flex gap-2 pl-1"><span className="text-ink-5">•</span><span>{line.slice(2)}</span></p>
        ) : (
          <p key={i}>{line}</p>
        ),
      )}
    </div>
  );
}

function Message({ msg }: { msg: ChatMessage }) {
  const { seek } = usePlayer();
  const { setFocusSegment } = useNotepad();
  if (msg.role === "user")
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-muted px-4 py-2.5 text-[14px] text-ink">{msg.content}</p>
      </div>
    );
  return (
    <div className="group text-[14px] leading-relaxed text-ink-2">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs text-ink-4"><Sparkles className="size-3.5 text-brand" /> Fred</p>
      <AnswerText text={msg.content} />
      {msg.citations.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {msg.citations.map((c) => (
            <button
              key={c.segment_id}
              onClick={() => { seek(c.start_ms, { play: true }); setFocusSegment(c.segment_id); }}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink-3 hover:border-brand-200 hover:text-brand"
              title={c.text}
            >
              <span className="text-link">{formatTimestamp(c.start_ms)}</span> {c.speaker ?? "Speaker"}
            </button>
          ))}
        </div>
      )}
      <div className="mt-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {[
          { icon: <Copy />, label: "Copy", run: () => { void navigator.clipboard?.writeText(msg.content); toast.success("Copied"); } },
          { icon: <ThumbsUp />, label: "Helpful", run: () => toast.success("Thanks for the feedback!") },
          { icon: <ThumbsDown />, label: "Not helpful", run: () => toast("Thanks — we'll use this to improve Fred.") },
        ].map((a) => (
          <button key={a.label} onClick={a.run} aria-label={a.label} title={a.label} className="rounded-md p-1.5 text-ink-4 hover:bg-muted [&_svg]:size-3.5">{a.icon}</button>
        ))}
      </div>
    </div>
  );
}

export function AskFredPanel({ meetingId }: { meetingId: number }) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data: history } = useChat(meetingId);
  const { data: suggestions } = useChatSuggestions(meetingId);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const ask = useMutation({
    mutationFn: (q: string) => api.ask(meetingId, q),
    onMutate: (q) => setPending(q),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.chat(meetingId) }),
    onError: errorToast,
    onSettled: () => setPending(null),
  });
  const clear = useMutation({
    mutationFn: () => api.clearChat(meetingId),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.chat(meetingId) }),
  });

  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [history, pending]);

  const send = (q: string) => {
    if (!q.trim() || ask.isPending) return;
    setInput("");
    ask.mutate(q.trim());
  };
  const empty = !history?.length && !pending;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {empty ? (
          <div className="pt-10">
            <Sparkles className="size-8 text-[#47cd89]" />
            <p className="mt-6 text-[20px] text-ink">Hi {me ? firstName(me.name) : "there"}!</p>
            <p className="text-[20px] text-ink">Ask anything about this meeting</p>
            <p className="mt-8 mb-2 text-[13px] text-ink-4">Try asking…</p>
            <div className="space-y-2">
              {suggestions?.map((s, i) => (
                <button key={s} onClick={() => send(s)}
                  className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left text-[14px] text-ink-2 shadow-xs hover:bg-subtle">
                  <Sparkles className={`size-4 shrink-0 ${SPARKLE_COLORS[i % 3]}`} /> {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-end">
              <button onClick={() => clear.mutate()} className="inline-flex items-center gap-1 text-xs text-ink-4 hover:text-danger">
                <Trash2 className="size-3.5" /> Clear chat
              </button>
            </div>
            {history?.map((m) => <Message key={m.id} msg={m} />)}
            {pending && (
              <>
                <div className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-muted px-4 py-2.5 text-[14px] text-ink">{pending}</p>
                </div>
                <p className="flex items-center gap-1 text-[13px] text-ink-4">
                  <Sparkles className="size-3.5 text-brand" /> Fred is thinking
                  <span className="typing-dot">.</span><span className="typing-dot [animation-delay:.2s]">.</span><span className="typing-dot [animation-delay:.4s]">.</span>
                </p>
              </>
            )}
            <div ref={bottom} />
          </div>
        )}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="border-t border-line p-3">
        <div className="flex items-end gap-2 rounded-xl border border-line-strong bg-surface p-2 focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-100">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Ask anything about this meeting…"
            aria-label="Ask Fred"
            className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-[14px] text-ink outline-none placeholder:text-ink-5"
          />
          <button type="submit" disabled={!input.trim() || ask.isPending} aria-label="Send"
            className="flex size-9 items-center justify-center rounded-lg bg-brand text-white hover:bg-brand-hover disabled:bg-brand-200">
            <ArrowUp className="size-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
