"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import {
  ArrowRight, PencilLine, RefreshCw,
  BellPlus, FileText, Archive,
} from "lucide-react";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import type { ProjectRow } from "@/modules/projects/queries";
import { archiveProject } from "@/modules/projects/actions";
import { MoreMenu, type MenuItem } from "@/components/data/MoreMenu";
import { ProjectStatusPill } from "./StatusPill";

function projectMenuItems(r: ProjectRow): MenuItem[] {
  const isArchived = r.stage === "CANCELLED" || r.stage === "COMPLETED";
  return [
    { key: "edit",     label: "Edit",             icon: PencilLine, href: `/projects/${r.id}/edit` },
    { key: "stage",    label: "Change Stage",      icon: RefreshCw,  href: `/projects/${r.id}` },
    { key: "followup", label: "Add Follow-up",     icon: BellPlus,   href: `/projects/${r.id}` },
    { key: "quote",    label: "Create Quotation",  icon: FileText,   href: `/projects/${r.id}/quote/new` },
    ...(!isArchived ? [{
      key:          "archive",
      label:        "Archive Project",
      icon:         Archive,
      danger:       true,
      separator:    true,
      confirm:      "Archive this project? It will be marked as Cancelled.",
      confirmLabel: "Archive",
      onClick:      () => void archiveProject(r.id),
    } as MenuItem] : []),
  ];
}

export function ProjectsTable({ rows }: { rows: ProjectRow[] }) {
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule py-16 text-center">
        <div className="text-[14px] text-text mb-2">No projects yet.</div>
        <p className="text-[12px] text-text-dim">
          Convert a lead to get started, or{" "}
          <Link href={"/projects/new" as Route} className="text-accent hover:underline">
            create a project directly.
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div
          key={r.id}
          className="rounded-[14px] border border-rule bg-surface hover:bg-surface-hover transition-colors p-4 cursor-pointer"
          onClick={() => router.push(`/projects/${r.id}` as Route)}
        >
          {/* Name + Stage pill */}
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <div className="font-semibold text-[13.5px] text-text leading-snug">{r.name}</div>
            <ProjectStatusPill status={r.stage} />
          </div>

          {/* Number + Client */}
          <div className="flex items-center gap-2 text-[12px] text-text-dim mb-3">
            <span className="font-mono text-[11.5px] tabular">{r.number}</span>
            <span className="opacity-40">·</span>
            <span>{r.clientName}</span>
          </div>

          {/* Value · Install date · Actions */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-text-dim">
              <span className="tabular font-medium text-text">{formatINR(r.orderValue)}</span>
              {r.expectedInstallAt && (
                <>
                  <span className="opacity-40">·</span>
                  <span>Install {formatDate(r.expectedInstallAt)}</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
              <Link
                href={`/projects/${r.id}` as Route}
                className="flex items-center gap-1 h-7 px-2.5 rounded-[6px] text-[11.5px] text-text-dim border border-rule hover:text-text hover:bg-surface-2 transition-colors"
              >
                Details <ArrowRight size={11} strokeWidth={1.75} />
              </Link>
              <MoreMenu items={projectMenuItems(r)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
