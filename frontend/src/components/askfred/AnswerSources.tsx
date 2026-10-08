// Sources under a cross-meeting AskFred answer: transcript citations, else the meetings it drew on.
// Shared by the AskFred page and the Meetings page's Ask Fred panel (`compact`).
import Link from "next/link";
import { formatShortDate, formatTimestamp } from "@/lib/format";
import type { WorkspaceAnswer } from "@/lib/types";

/** One message in a cross-meeting AskFred chat. */
export interface WorkspaceTurn {
  role: "user" | "assistant";
  content: string;
  data?: WorkspaceAnswer;
}

const chip = "rounded-full border border-line text-ink-3 hover:text-brand";

export function AnswerSources({ data, compact = false }: { data?: WorkspaceAnswer; compact?: boolean }) {
  if (!data) return null;
  if (data.citations.length) {
    if (compact) {
      return (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {data.citations.slice(0, 4).map((c) => (
            <Link key={c.segment_id} href={`/meetings/${c.meeting_id}?t=${c.start_ms}`} title={c.text} className={`${chip} px-2 py-0.5 text-[11px]`}>
              {c.meeting_title} · <span className="text-link">{formatTimestamp(c.start_ms)}</span>
            </Link>
          ))}
        </div>
      );
    }
    return (
      <div className="mt-4 space-y-2">
        <p className="text-xs font-medium text-ink-4">Sources</p>
        {data.citations.map((c) => (
          <Link key={c.segment_id} href={`/meetings/${c.meeting_id}?t=${c.start_ms}`}
            className="block rounded-lg border border-line px-3 py-2 hover:border-brand-200 hover:bg-brand-soft/40">
            <span className="text-[13px] font-medium text-ink">{c.meeting_title}</span>
            <span className="ml-2 text-xs text-link">{formatTimestamp(c.start_ms)}</span>
            <span className="ml-1 text-xs text-ink-4">· {c.speaker}</span>
            <span className="mt-0.5 line-clamp-2 block text-[13px] text-ink-3">“{c.text}”</span>
          </Link>
        ))}
      </div>
    );
  }
  if (!data.meetings.length) return null;
  return (
    <div className={compact ? "mt-2 flex flex-wrap gap-1.5" : "mt-3 flex flex-wrap gap-1.5"}>
      {data.meetings.slice(0, compact ? 4 : 6).map((m) => (
        <Link key={m.meeting_id} href={`/meetings/${m.meeting_id}`} className={`${chip} ${compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"}`}>
          {m.meeting_title} · {formatShortDate(m.started_at)}
        </Link>
      ))}
    </div>
  );
}
