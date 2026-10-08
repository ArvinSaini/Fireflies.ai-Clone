"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Command-palette style: no header, aligned near the top. */
  bare?: boolean;
}

const WIDTHS = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl" };

export function Modal({ open, onClose, title, description, children, footer, size = "md", className, bare }: ModalProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus the first field (or the panel) for keyboard users.
    const first = panel.current?.querySelector<HTMLElement>("input, textarea, select, [data-autofocus]");
    (first ?? panel.current)?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      className={cn("fixed inset-0 z-50 flex justify-center bg-[#0c111d]/40 p-4 backdrop-blur-[2px]", bare ? "items-start pt-[12vh]" : "items-center")}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        tabIndex={-1}
        className={cn(
          "animate-fade-in flex max-h-[85vh] w-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-pop outline-none",
          WIDTHS[size],
          className,
        )}
      >
        {!bare && (title || description) && (
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
            <div>
              <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
              {description && <p className="mt-0.5 text-[13px] text-ink-4">{description}</p>}
            </div>
            <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-ink-4 hover:bg-muted hover:text-ink">
              <X className="size-5" />
            </button>
          </div>
        )}
        <div className={cn("min-h-0 flex-1 overflow-y-auto", !bare && "px-6 py-5")}>{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line bg-subtle/50 px-6 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
