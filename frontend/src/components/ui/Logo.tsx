import { cn } from "@/lib/utils";

/** Fireflies-style "F" mark built from three blocks with a pink→purple gradient. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-6", className)} aria-hidden>
      <defs>
        <linearGradient id="ff-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff3d8b" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="18" height="6" rx="1.6" fill="url(#ff-grad)" />
      <rect x="3" y="10.5" width="6" height="10.5" rx="1.6" fill="url(#ff-grad)" />
      <rect x="10.5" y="10.5" width="7.5" height="5" rx="1.6" fill="url(#ff-grad)" opacity="0.85" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="text-[19px] font-semibold tracking-tight text-ink">fireflies.ai</span>
    </span>
  );
}
