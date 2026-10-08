"use client";
// Small presentational building blocks shared across pages.
import { Check } from "lucide-react";
import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { icon?: ReactNode }>(
  function Input({ className, icon, ...props }, ref) {
    return (
      <div className="relative w-full">
        {icon && <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-5 [&>svg]:size-4">{icon}</span>}
        <input
          ref={ref}
          className={cn(
            "h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink shadow-xs outline-none placeholder:text-ink-5",
            "focus:border-brand-400 focus:ring-4 focus:ring-brand-100",
            icon && "pl-9",
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink shadow-xs outline-none placeholder:text-ink-5",
        "focus:border-brand-400 focus:ring-4 focus:ring-brand-100",
        className,
      )}
      {...props}
    />
  );
});

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-4">{hint}</span>}
    </label>
  );
}

export function Checkbox({
  checked, onChange, label, className, indeterminate,
}: { checked: boolean; onChange: (v: boolean) => void; label?: string; className?: string; indeterminate?: boolean }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
        checked || indeterminate ? "border-brand bg-brand text-white" : "border-line-strong bg-surface hover:border-brand-400",
        className,
      )}
    >
      {indeterminate ? <span className="h-0.5 w-2 rounded bg-white" /> : checked && <Check className="size-3" strokeWidth={3} />}
    </button>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-ink" : "bg-line-strong")}
    >
      <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-all", checked ? "left-[18px]" : "left-0.5")} />
    </button>
  );
}

/** Pill-style segmented control ("Hosted by me | Shared with me", "Recent | Upcoming | AI Feed"). */
export function Segmented<T extends string>({
  value, onChange, options, variant = "outline",
}: {
  value: T | null;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  variant?: "outline" | "pill";
}) {
  if (variant === "pill")
    return (
      <div className="inline-flex rounded-lg bg-muted p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
              value === o.value ? "bg-surface text-ink shadow-xs" : "text-ink-4 hover:text-ink-2",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    );
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-line-strong shadow-xs">
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "px-3.5 py-2 text-[13px] font-medium transition-colors",
            i && "border-l border-line-strong",
            value === o.value ? "bg-brand-soft text-brand-hover" : "bg-surface text-ink-3 hover:bg-subtle",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

export function EmptyState({
  icon, title, description, action,
}: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-brand-soft text-brand [&>svg]:size-6">{icon}</div>}
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-ink-4">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line bg-subtle px-1.5 py-0.5 font-sans text-[11px] text-ink-4">{children}</kbd>;
}

export function NewBadge({ children = "NEW", tone = "green" }: { children?: ReactNode; tone?: "green" | "purple" }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide",
        tone === "green" ? "bg-success-soft text-success" : "bg-brand-soft text-brand",
      )}
    >
      {children}
    </span>
  );
}
