import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "soft" | "ghost" | "danger" | "link";
type Size = "xs" | "sm" | "md";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-hover shadow-xs disabled:opacity-60",
  secondary: "bg-surface text-ink-2 border border-line-strong hover:bg-subtle shadow-xs",
  soft: "bg-brand-soft text-brand-hover hover:bg-brand-100",
  ghost: "text-ink-3 hover:bg-muted hover:text-ink",
  danger: "bg-danger text-white hover:opacity-90 shadow-xs",
  link: "text-brand hover:text-brand-hover px-0",
};
const sizes: Record<Size, string> = {
  xs: "h-7 px-2 text-xs gap-1 rounded-md",
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-lg",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "sm", className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
