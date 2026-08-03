import type { ClientStatus } from "@/modules/clients/schema";

const TONE: Record<ClientStatus, string> = {
  ACTIVE:      "bg-good/12 text-good",
  INACTIVE:    "bg-text-dim/12 text-text-dim",
  BLACKLISTED: "bg-bad/12 text-bad",
};

const LABEL: Record<ClientStatus, string> = {
  ACTIVE:      "Active",
  INACTIVE:    "Inactive",
  BLACKLISTED: "Blacklisted",
};

export function StatusPill({ status }: { status: string }) {
  const key = status as ClientStatus;
  const tone = TONE[key] ?? "bg-text-dim/12 text-text-dim";
  const label = LABEL[key] ?? status;
  return (
    <span
      className={`inline-block text-[10.5px] font-medium tracking-[0.06em] uppercase px-2 py-0.5 rounded-[3px] ${tone}`}
    >
      {label}
    </span>
  );
}
