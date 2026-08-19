// Badge — status as a tinted chip. §6.3.11 requires status to be "dot + word,
// never colour alone", so `dot` is on by default for the status tones and the
// label text is always present; colour is reinforcement, not the signal.

import type { ReactNode } from "react";

export type BadgeTone =
  | "neutral" | "accent" | "solid" | "heat" | "fault" | "info" | "gold";

const TONE: Record<BadgeTone, { chip: string; dot: string }> = {
  neutral: { chip: "bg-surface-2 text-text-muted border-rule",        dot: "bg-text-subtle" },
  accent:  { chip: "bg-accent/10 text-accent border-accent/25",       dot: "bg-accent" },
  solid:   { chip: "bg-solid/10  text-solid  border-solid/25",        dot: "bg-solid" },
  heat:    { chip: "bg-heat/10   text-heat   border-heat/25",         dot: "bg-heat" },
  fault:   { chip: "bg-fault/10  text-fault  border-fault/25",        dot: "bg-fault" },
  info:    { chip: "bg-info/10   text-info   border-info/25",         dot: "bg-info" },
  gold:    { chip: "bg-gold/10   text-gold   border-gold/25",         dot: "bg-gold" },
};

interface Props {
  children: ReactNode;
  tone?: BadgeTone;
  /** Off for pure labels (a brand name, a unit) where a status dot would lie. */
  dot?: boolean;
  className?: string;
}

export function Badge({ children, tone = "neutral", dot = true, className = "" }: Props) {
  const t = TONE[tone];
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 border rounded-full",
        "px-2 py-[2px] text-[10.5px] font-medium tracking-[0.02em] whitespace-nowrap",
        t.chip,
        className,
      ].join(" ")}
    >
      {dot && <span className={`h-[5px] w-[5px] rounded-full shrink-0 ${t.dot}`} aria-hidden />}
      {children}
    </span>
  );
}

/** The dye-lot chip (§6.3.6). Mono, because a lot code is read character by
 *  character when someone is standing in front of two nearly identical rolls. */
export function LotChip({ lot, mixed = false }: { lot: string; mixed?: boolean }) {
  return (
    <span
      title={mixed ? "Mixed-lot allocation — overridden" : `Dye lot ${lot}`}
      className={[
        "inline-flex items-center gap-1 rounded-[5px] border px-1.5 py-[1px]",
        "font-data text-[10.5px] tracking-[0.04em] whitespace-nowrap",
        mixed
          ? "bg-fault/10 text-fault border-fault/30"
          : "bg-surface-2 text-text-muted border-rule",
      ].join(" ")}
    >
      {lot}
    </span>
  );
}
