// Card — the standard container. Elevation comes from the --shadow-* tokens,
// which are real in Studio Porcelain and `none` in Malachite: §6.2 specifies
// that the dark theme lifts with border + surface tone instead of shadow, so
// the same markup is correct in both themes with no conditional.

import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Raise on hover — for cards that are themselves links or buttons. */
  interactive?: boolean;
  /** A status colour rendered as a 3px left edge (order state, lot warning). */
  edge?: "accent" | "solid" | "heat" | "fault" | "info" | "gold";
}

const EDGE: Record<string, string> = {
  accent: "border-l-[3px] border-l-accent",
  solid:  "border-l-[3px] border-l-solid",
  heat:   "border-l-[3px] border-l-heat",
  fault:  "border-l-[3px] border-l-fault",
  info:   "border-l-[3px] border-l-info",
  gold:   "border-l-[3px] border-l-gold",
};

export function Card({ children, className = "", interactive, edge }: CardProps) {
  return (
    <div
      className={[
        "bg-surface border border-rule rounded-[var(--radius-md)] shadow-sm",
        interactive
          ? "transition-[box-shadow,border-color] duration-200 hover:shadow-md hover:border-rule-strong"
          : "",
        edge ? EDGE[edge] : "",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`px-4 py-3 border-b border-rule flex items-center justify-between gap-3 ${className}`}>
      {children}
    </div>
  );
}

/** The small caps eyebrow above a card's real title (§6.2 type scale). */
export function CardEyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-subtle">{children}</div>
  );
}

export function CardTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h2 className={`font-display text-[17px] text-text ${className}`}>{children}</h2>;
}

export function CardBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}
