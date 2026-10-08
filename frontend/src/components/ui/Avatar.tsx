import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

const SIZES = {
  xs: "size-5 text-[10px] rounded",
  sm: "size-6 text-[11px] rounded-md",
  md: "size-8 text-[13px] rounded-md",
  lg: "size-12 text-lg rounded-lg",
} as const;

/** Fireflies avatars are rounded squares with a white initial. */
export function Avatar({
  name, color, size = "sm", className, single = true,
}: { name: string; color?: string; size?: keyof typeof SIZES; className?: string; single?: boolean }) {
  return (
    <span
      title={name}
      className={cn("inline-flex shrink-0 items-center justify-center font-medium text-white select-none", SIZES[size], className)}
      style={{ backgroundColor: color ?? "var(--avatar)" }}
    >
      {single ? (name.trim()[0] ?? "?").toUpperCase() : initials(name)}
    </span>
  );
}

export function AvatarStack({ people, max = 4 }: { people: { name: string; color: string }[]; max?: number }) {
  const shown = people.slice(0, max);
  return (
    <span className="inline-flex items-center">
      {shown.map((p, i) => (
        <Avatar key={`${p.name}-${i}`} name={p.name} color={p.color} size="xs" className={cn("ring-2 ring-surface", i && "-ml-1.5")} />
      ))}
      {people.length > max && <span className="ml-1 text-xs text-ink-4">+{people.length - max}</span>}
    </span>
  );
}
