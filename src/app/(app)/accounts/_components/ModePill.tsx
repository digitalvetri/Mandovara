import type { PaymentMode } from "@/modules/receipts/schema";

const TONE: Record<PaymentMode, string> = {
  CASH:   "bg-good/12 text-good",
  UPI:    "bg-accent/12 text-accent",
  NEFT:   "bg-accent/12 text-accent",
  RTGS:   "bg-accent/12 text-accent",
  CHEQUE: "bg-warn/15 text-warn",
  CARD:   "bg-accent/12 text-accent",
};

export function ModePill({ mode }: { mode: string }) {
  const tone = TONE[mode as PaymentMode] ?? "bg-text-dim/12 text-text-dim";
  return (
    <span
      className={`inline-block text-[10.5px] font-medium tracking-[0.06em] uppercase px-2 py-0.5 rounded-[3px] ${tone}`}
    >
      {mode}
    </span>
  );
}
