// The one button. Before this existed every screen hand-rolled its own, which
// is why the app had four different primary greens and three heights.
//
// No "use client": this component holds no state, so it works inside a server
// component AND gets bundled into the client graph automatically when a client
// component passes it an onClick.

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  // §6.1 — exactly one primary action per screen. The accent is reserved for it.
  primary:
    "bg-accent text-white hover:bg-accent-hover active:bg-accent-dim " +
    "border border-transparent shadow-sm",
  secondary:
    "bg-surface text-text border border-rule hover:bg-surface-hover " +
    "hover:border-rule-strong shadow-sm",
  ghost:
    "bg-transparent text-text-muted border border-transparent " +
    "hover:bg-surface-hover hover:text-text",
  // Financial and destructive actions name themselves before they are clicked.
  danger:
    "bg-fault text-white hover:opacity-90 border border-transparent shadow-sm",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-[30px] px-2.5 text-[12px] gap-1.5 rounded-[6px]",
  md: "h-[36px] px-3.5 text-[12.5px] gap-2 rounded-[8px]",
  // §6.3.4 — the field PWA needs ≥56px targets; lg is what those screens use.
  lg: "h-[56px] px-5 text-[14px] gap-2.5 rounded-[10px]",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Render edge-to-edge in its container — the default on mobile sheets. */
  block?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  block = false,
  disabled,
  className = "",
  children,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        "inline-flex items-center justify-center font-medium whitespace-nowrap",
        "transition-[background-color,border-color,color,opacity] duration-140 press",
        "disabled:opacity-45 disabled:pointer-events-none",
        VARIANT[variant],
        SIZE[size],
        block ? "w-full" : "",
        className,
      ].join(" ")}
    >
      {loading && <Loader2 size={14} strokeWidth={2} className="animate-spin shrink-0" />}
      {children}
    </button>
  );
}
