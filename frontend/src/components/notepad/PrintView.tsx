"use client";
// Clean, paginated document of a meeting (notes + action items + transcript) for "Save as PDF".
import { Printer } from "lucide-react";
import { useEffect, useRef } from "react";
import { LogoMark } from "@/components/ui/Logo";
import { formatDuration, formatLongDate, formatTimestamp } from "@/lib/format";
import { useMeeting, useTranscript } from "@/lib/queries";

export function PrintView({ id }: { id: number }) {
  const { data: meeting } = useMeeting(id);
  const { data: segments } = useTranscript(id);
  const printed = useRef(false);
  const ready = !!meeting && !!segments;

  // Open the print dialog once, after the document has rendered.
  useEffect(() => {
    if (!ready || printed.current) return;
    printed.current = true;
    const t = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(t);
  }, [ready]);

  if (!ready) return <p className="p-10 text-ink-4">Preparing document…</p>;
  const s = meeting.summary;

  return (
    <article className="mx-auto max-w-[780px] bg-white px-10 py-10 text-[13px] leading-relaxed text-[#101828] print:p-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <p className="text-[#667085]">Use your browser&apos;s “Save as PDF” destination to download.</p>
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-[#6938ef] px-3 py-2 text-white">
          <Printer className="size-4" /> Print / Save as PDF
        </button>
      </div>

      <header className="border-b border-[#eaecf0] pb-4">
        <div className="flex items-center gap-2 text-[12px] text-[#667085]"><LogoMark className="size-4" /> fireflies.ai · Meeting notes</div>
        <h1 className="mt-2 text-[24px] font-semibold">{meeting.title}</h1>
        <p className="mt-1 text-[#475467]">
          {formatLongDate(meeting.started_at)} · {formatDuration(meeting.duration_ms)} · {meeting.language}
        </p>
        <p className="text-[#475467]">Participants: {meeting.participants.map((p) => p.name).join(", ") || "—"}</p>
      </header>

      {s && (
        <>
          {s.keywords.length > 0 && <p className="mt-4"><b>Keywords:</b> {s.keywords.join(" · ")}</p>}
          <h2 className="mt-6 text-[16px] font-semibold">Overview</h2>
          <p className="mt-1">{s.overview}</p>
          {s.notes.length > 0 && <h2 className="mt-6 text-[16px] font-semibold">Notes</h2>}
          {s.notes.map((n, i) => (
            <section key={i} className="mt-3 break-inside-avoid">
              <h3 className="font-semibold">{n.heading}{n.start_ms != null && <span className="font-normal text-[#667085]"> ({formatTimestamp(n.start_ms)})</span>}</h3>
              <ul className="mt-1 list-disc pl-5">{n.bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>
            </section>
          ))}
        </>
      )}

      {meeting.action_items.length > 0 && (
        <section className="break-inside-avoid">
          <h2 className="mt-6 text-[16px] font-semibold">Action items</h2>
          <ul className="mt-1 space-y-1">
            {meeting.action_items.map((a) => (
              <li key={a.id}>{a.is_completed ? "☑" : "☐"} {a.text}{a.assignee && <span className="text-[#667085]"> — {a.assignee.name}</span>}</li>
            ))}
          </ul>
        </section>
      )}

      {meeting.chapters.length > 0 && (
        <section className="break-inside-avoid">
          <h2 className="mt-6 text-[16px] font-semibold">Outline</h2>
          <ol className="mt-1 list-decimal pl-5">
            {meeting.chapters.map((c) => <li key={c.id}><b>{c.title}</b> ({formatTimestamp(c.start_ms)}) — {c.description}</li>)}
          </ol>
        </section>
      )}

      <h2 className="mt-8 break-before-page text-[16px] font-semibold">Transcript</h2>
      <div className="mt-2 space-y-2">
        {segments.map((seg) => (
          <p key={seg.id} className="break-inside-avoid">
            <b>{seg.speaker?.name ?? "Unknown"}</b> <span className="text-[#667085]">{formatTimestamp(seg.start_ms)}</span><br />
            {seg.text}
          </p>
        ))}
      </div>
    </article>
  );
}
