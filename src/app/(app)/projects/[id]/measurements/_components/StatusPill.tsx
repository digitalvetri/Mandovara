// Small deterministic status pill used in the rounds list and detail
// header. Colour comes from Sovereign tokens (globals.css) — no
// hardcoded hex. The DOT + WORD combo satisfies §12 rule 11 (status
// is never colour alone).

type Status = "DRAFT" | "SUBMITTED" | "APPROVED" | "SUPERSEDED";

interface StatusPillProps {
  status: Status;
  muted?: boolean;
}

const STYLES: Record<Status, { label: string; dot: string; text: string; bg: string }> = {
  DRAFT:      { label: "Draft",      dot: "bg-text-dim",  text: "text-text",       bg: "bg-surface-hover" },
  SUBMITTED:  { label: "Submitted",  dot: "bg-info",      text: "text-info-strong", bg: "bg-info-tint" },
  APPROVED:   { label: "Approved",   dot: "bg-solid",     text: "text-solid-strong", bg: "bg-solid-tint" },
  SUPERSEDED: { label: "Superseded", dot: "bg-text-dim",  text: "text-text-dim",   bg: "bg-surface-2" },
};

export function StatusPill({ status, muted = false }: StatusPillProps) {
  const s = STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${s.text} ${s.bg} ${muted ? "opacity-70" : ""}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
      {s.label}
    </span>
  );
}
