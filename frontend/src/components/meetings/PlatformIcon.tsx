import { ClipboardPaste, MonitorSmartphone, PenLine, Upload, Video } from "lucide-react";
import type { Platform } from "@/lib/types";
import { cn } from "@/lib/utils";

/** "Captured from" options, in the order the Filters popover lists them. */
export const PLATFORMS: { value: Platform; label: string }[] = [
  { value: "zoom", label: "Zoom" },
  { value: "google_meet", label: "Google Meet" },
  { value: "teams", label: "Microsoft Teams" },
  { value: "upload", label: "Uploads" },
  { value: "paste", label: "Pasted transcript" },
  { value: "manual", label: "Created manually" },
];

export const platformLabel = (p: string) => PLATFORMS.find((x) => x.value === p)?.label ?? p;

/** Small capture-source glyph shown after a meeting title (like Fireflies' bot / chrome / desktop icons). */
export function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  const cls = cn("size-4 text-ink-5", className);
  switch (platform) {
    case "zoom":
      return <span title="Zoom" className={cn("inline-flex size-4 items-center justify-center rounded bg-[#2d8cff] text-white", className)}><Video className="size-2.5" /></span>;
    case "google_meet":
      return (
        <span title="Google Meet" className={cn("inline-flex size-4 items-center justify-center", className)}>
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
            <path fill="#00832d" d="M14 12l2.5 2.9 3.4 2.2.6-5.1-.6-4.9-3.4 1.9z" />
            <path fill="#0066da" d="M3 16.1V20a1 1 0 001 1h3.9l.8-2.9-.8-2.5-2.6-.8z" />
            <path fill="#e94235" d="M7.9 3L3 7.9l2.5.8 2.4-.8.8-2.4z" />
            <path fill="#2684fc" d="M7.9 7.9H3v8.2h4.9z" />
            <path fill="#00ac47" d="M20.2 5.3L17 7.9v8.2l3.2 2.6c.5.4 1.2.1 1.2-.6V5.9c0-.7-.7-1-1.2-.6zM14 12v4.1H7.9V21h7.3a1 1 0 001-1v-3z" />
            <path fill="#ffba00" d="M15.2 3H7.9v4.9H14V12l2.2-1.9V4a1 1 0 00-1-1z" />
          </svg>
        </span>
      );
    case "teams":
      return <span title="Microsoft Teams" className={cn("inline-flex size-4 items-center justify-center rounded bg-[#5059c9] text-[9px] font-bold text-white", className)}>T</span>;
    case "upload":
      return <span title="Uploaded file"><Upload className={cls} /></span>;
    case "paste":
      return <span title="Pasted transcript"><ClipboardPaste className={cls} /></span>;
    case "manual":
      return <span title="Created manually"><PenLine className={cls} /></span>;
    default:
      return <span title="Desktop app"><MonitorSmartphone className={cls} /></span>;
  }
}
