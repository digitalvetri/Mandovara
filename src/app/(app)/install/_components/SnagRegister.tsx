import Link from "next/link";
import type { Route } from "next";
import { AlertTriangle } from "lucide-react";
import type { SnagListRow } from "@/modules/install/queries";

interface Props {
  snags: SnagListRow[];
}

const STATUS_COLORS: Record<string, string> = {
  OPEN:        "text-fault bg-fault/10 border-fault/30",
  IN_PROGRESS: "text-heat bg-heat/10 border-heat/30",
};

const STATUS_LABELS: Record<string, string> = {
  OPEN:        "Open",
  IN_PROGRESS: "In Progress",
};

export function SnagRegister({ snags }: Props) {
  if (snags.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle size={40} className="text-solid mb-3" strokeWidth={1.2} />
        <p className="text-[14px] text-text-muted">No open snags — all resolved</p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-4 py-2.5 text-text-muted font-medium">Project · Client</th>
            <th className="px-4 py-2.5 text-text-muted font-medium">Room</th>
            <th className="px-4 py-2.5 text-text-muted font-medium">Description</th>
            <th className="px-4 py-2.5 text-text-muted font-medium">Raised</th>
            <th className="px-4 py-2.5 text-text-muted font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {snags.map((s, i) => (
            <tr
              key={s.id}
              className={`hover:bg-surface-2/40 transition-colors ${i < snags.length - 1 ? "border-b border-border/50" : ""}`}
            >
              <td className="px-4 py-3">
                <Link
                  href={`/projects/${s.projectId}` as Route}
                  className="text-text hover:text-gold transition-colors"
                >
                  {s.projectName}
                </Link>
                <div className="text-[11px] text-text-muted">{s.clientName}</div>
              </td>
              <td className="px-4 py-3 text-text-muted">
                {s.roomLabel ?? <span className="text-text-subtle">—</span>}
              </td>
              <td className="px-4 py-3 text-text max-w-[280px]">
                <span className="line-clamp-2">{s.description}</span>
              </td>
              <td className="px-4 py-3 font-data text-text-muted whitespace-nowrap">
                {new Date(s.raisedAt).toLocaleDateString("en-IN", {
                  day: "2-digit", month: "short",
                  timeZone: "Asia/Kolkata",
                })}
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[s.status] ?? ""}`}>
                  <AlertTriangle size={9} />
                  {STATUS_LABELS[s.status] ?? s.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
