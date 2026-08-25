import { Sun, Thermometer, Star, RefreshCw, MinusCircle } from "lucide-react";

export type LeaveTypeValue = "CASUAL" | "SICK" | "EARNED" | "COMP_OFF" | "UNPAID";

export const LEAVE_TYPES = [
  { value: "CASUAL"   as const, label: "Casual",   desc: "Personal errands & day-offs",  Icon: Sun,         hex: "#F59E0B", bgHex: "rgba(245,158,11,0.12)",  rHex: "rgba(245,158,11,0.30)"  },
  { value: "SICK"     as const, label: "Sick",      desc: "Medical or health reasons",    Icon: Thermometer, hex: "#EF4444", bgHex: "rgba(239,68,68,0.10)",   rHex: "rgba(239,68,68,0.30)"   },
  { value: "EARNED"   as const, label: "Earned",    desc: "Accrued paid leave",           Icon: Star,        hex: "#8B5CF6", bgHex: "rgba(139,92,246,0.10)",  rHex: "rgba(139,92,246,0.30)"  },
  { value: "COMP_OFF" as const, label: "Comp-off",  desc: "Compensatory time off",        Icon: RefreshCw,   hex: "#3B82F6", bgHex: "rgba(59,130,246,0.10)",  rHex: "rgba(59,130,246,0.30)"  },
  { value: "UNPAID"   as const, label: "Unpaid",    desc: "Leave without pay",            Icon: MinusCircle, hex: "#94A3B8", bgHex: "rgba(148,163,184,0.10)", rHex: "rgba(148,163,184,0.28)" },
] as const;

export const TYPE_LABEL: Record<string, string> = {
  CASUAL: "Casual", SICK: "Sick", EARNED: "Earned", COMP_OFF: "Comp-off", UNPAID: "Unpaid",
};

export const STATE_COLOR: Record<string, string> = {
  PENDING: "#F59E0B", APPROVED: "#10B981", REJECTED: "#EF4444",
};

export interface Employee {
  id: string; name: string; designation: string | null; department: string | null; code: string;
}

export interface RecentLeave {
  id: string; type: string; fromDate: string; toDate: string; days: number; state: string;
}

export function todayStr(): string {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

export function calcDays(from: string, to: string): number {
  if (!from || !to) return 0;
  const diff = new Date(to).getTime() - new Date(from).getTime();
  return diff < 0 ? 0 : Math.round(diff / 86_400_000) + 1;
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}
