"use client";

import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Click-to-open floating panel anchored to its trigger; closes on outside click / Escape. */
export function Popover({
  trigger, children, align = "start", className, open: controlled, onOpenChange, side = "bottom",
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: "start" | "end";
  side?: "bottom" | "top";
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [inner, setInner] = useState(false);
  const open = controlled ?? inner;
  const setOpen = (v: boolean) => (onOpenChange ? onOpenChange(v) : setInner(v));
  const ref = useRef<HTMLDivElement>(null);

  // Effect event: always sees the latest setOpen without re-subscribing listeners.
  const dismiss = useEffectEvent(() => setOpen(false));
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && dismiss();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);
  return (
    <div ref={ref} className="relative inline-flex">
      {trigger({ open, toggle: () => setOpen(!open) })}
      {open && (
        <div
          className={cn(
            "animate-fade-in absolute z-40 min-w-48 rounded-xl border border-line bg-surface p-1 shadow-pop",
            side === "bottom" ? "top-full mt-1.5" : "bottom-full mb-1.5",
            align === "end" ? "right-0" : "left-0",
            className,
          )}
        >
          {typeof children === "function" ? children(close) : children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  icon, children, onClick, danger, badge, disabled,
}: { icon?: ReactNode; children: ReactNode; onClick?: () => void; danger?: boolean; badge?: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] disabled:opacity-50",
        danger ? "text-danger hover:bg-danger-soft" : "text-ink-2 hover:bg-muted",
      )}
    >
      {icon && <span className={cn("[&>svg]:size-4", danger ? "text-danger" : "text-ink-4")}>{icon}</span>}
      <span className="flex-1">{children}</span>
      {badge}
    </button>
  );
}

export const MenuSeparator = () => <div className="my-1 h-px bg-line" />;
