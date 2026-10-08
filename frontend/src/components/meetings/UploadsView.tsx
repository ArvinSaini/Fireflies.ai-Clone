"use client";

import { Upload } from "lucide-react";
import Link from "next/link";
import { Topbar } from "@/components/layout/Topbar";
import { EmptyState, Skeleton } from "@/components/ui/Primitives";
import { formatBytes, formatDuration, formatShortDate } from "@/lib/format";
import { useMeetings } from "@/lib/queries";
import { useCreateMeeting } from "./CreateMeetingModal";

const BADGE_COLORS: Record<string, string> = { vtt: "#2e90fa", srt: "#7a5af8", json: "#f79009", txt: "#12b76a" };

export function UploadsView() {
  const create = useCreateMeeting();
  const { data, isLoading } = useMeetings({ platform: ["upload", "paste"], page_size: 100 });

  return (
    <>
      <Topbar title="Uploads" />
      <main className="flex-1 overflow-y-auto bg-surface px-6 py-6">
        <button
          type="button"
          onClick={() => create("upload")}
          className="flex w-full flex-col items-center rounded-xl border border-dashed border-brand-400 bg-brand-soft px-6 py-10 text-center transition-colors hover:bg-brand-100"
        >
          <Upload className="size-6 text-brand" />
          <p className="mt-3 text-[15px] text-ink-2">Upload meeting transcripts</p>
          <p className="mt-1 text-[14px] text-ink-4">
            .txt, .vtt, .srt or .json up to 5 MB. <span className="underline decoration-dashed">Supported formats</span>
          </p>
          <span className="mt-4 inline-flex h-8 items-center rounded-lg border border-line-strong bg-surface px-3 text-[13px] font-medium text-ink-2 shadow-xs">
            Browse Files
          </span>
        </button>

        <h2 className="mt-8 mb-3 text-[15px] font-medium text-ink">My Uploads</h2>
        <div className="space-y-3">
          {isLoading && Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-[74px] rounded-xl" />)}
          {data?.items.map((m) => {
            const ext = (m.source_filename?.split(".").pop() ?? (m.platform === "paste" ? "txt" : "file")).toLowerCase();
            return (
              <Link key={m.id} href={`/meetings/${m.id}`} className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4 hover:bg-subtle">
                <span className="flex h-10 w-12 items-center justify-center rounded-md text-[11px] font-bold text-white uppercase"
                  style={{ background: BADGE_COLORS[ext] ?? "#667085" }}>
                  {ext}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-ink">{m.title}</span>
                  <span className="text-[13px] text-ink-4">
                    {[formatShortDate(m.started_at), formatDuration(m.duration_ms), m.source_size_bytes ? formatBytes(m.source_size_bytes) : "Pasted"].join(" · ")}
                  </span>
                </span>
              </Link>
            );
          })}
          {!isLoading && !data?.items.length && (
            <EmptyState icon={<Upload />} title="No uploads yet" description="Uploaded and pasted transcripts show up here." />
          )}
        </div>
      </main>
    </>
  );
}
