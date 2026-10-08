"use client";

import { formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";
import { usePlayer } from "./PlayerContext";

/** Blue underlined timestamp that seeks the player (used in notes, action items, transcript, AskFred). */
export function Timestamp({ ms, className, play = true }: { ms: number; className?: string; play?: boolean }) {
  const { seek } = usePlayer();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        seek(ms, { play });
      }}
      className={cn("text-link underline decoration-1 underline-offset-2 hover:opacity-80", className)}
      title={`Jump to ${formatTimestamp(ms)}`}
    >
      {formatTimestamp(ms)}
    </button>
  );
}
