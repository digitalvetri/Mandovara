"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import {
  MoreHorizontal, ArrowRight, PencilLine, RefreshCw,
  BellPlus, FileText, Archive,
} from "lucide-react";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import type { ProjectRow } from "@/modules/projects/queries";
import { ProjectStatusPill } from "./StatusPill";

const MENU_ITEMS = [
  { label: "Edit",             icon: PencilLine, danger: false, href: (id: string) => `/projects/${id}/edit` },
  { label: "Change Stage",     icon: RefreshCw,  danger: false, href: (_: string) => null },
  { label: "Add Follow-up",    icon: BellPlus,   danger: false, href: (_: string) => null },
  { label: "Create Quotation", icon: FileText,   danger: false, href: (id: string) => `/projects/${id}/quote/new` },
  { label: "Archive",          icon: Archive,    danger: true,  href: (_: string) => null },
] as const;

export function ProjectsTable({ rows }: { rows: ProjectRow[] }) {
  const router = useRouter();
  const [openMenu, setOpenMenu] = useState<string | null>(null);

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

  function toggleMenu(id: string) {
    setOpenMenu((prev) => (prev === id ? null : id));
  }
  function closeMenu() {
    setTimeout(() => setOpenMenu(null), 120);
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

          {/* Value · Install date · Owner + action buttons */}
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

            {/* Stopgap: prevent card click from firing */}
            <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
              <Link
                href={`/projects/${r.id}` as Route}
                className="flex items-center gap-1 h-7 px-2.5 rounded-[6px] text-[11.5px] text-text-dim border border-rule hover:text-text hover:bg-surface-2 transition-colors"
              >
                Details <ArrowRight size={11} strokeWidth={1.75} />
              </Link>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => toggleMenu(r.id)}
                  onBlur={closeMenu}
                  className="h-7 w-7 grid place-items-center rounded-[6px] text-text-dim border border-rule hover:text-text hover:bg-surface-2 transition-colors"
                  aria-label="More actions"
                >
                  <MoreHorizontal size={13} strokeWidth={2} />
                </button>
                {openMenu === r.id && (
                  <div className="absolute right-0 top-full mt-1 z-30 w-[188px] rounded-[10px] bg-surface border border-rule shadow-xl py-1">
                    {MENU_ITEMS.map((item) => {
                      const href = item.href(r.id);
                      const cls = [
                        "flex items-center gap-2.5 w-full px-3 h-8 text-[12.5px] text-left transition-colors hover:bg-surface-hover",
                        item.danger ? "text-fault" : "text-text",
                      ].join(" ");
                      if (href) {
                        return (
                          <Link key={item.label} href={href as Route} className={cls}>
                            <item.icon size={12} strokeWidth={1.75} className={item.danger ? "text-fault" : "text-text-dim"} />
                            {item.label}
                          </Link>
                        );
                      }
                      return (
                        <button key={item.label} type="button" className={cls}>
                          <item.icon size={12} strokeWidth={1.75} className={item.danger ? "text-fault" : "text-text-dim"} />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
