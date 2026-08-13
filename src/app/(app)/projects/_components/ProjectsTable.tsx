"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import { shortNumber } from "@/lib/short-number";
import type { ProjectRow } from "@/modules/projects/queries";
import { ProjectStatusPill } from "./StatusPill";

export function ProjectsTable({ rows }: { rows: ProjectRow[] }) {
  const router = useRouter();
  if (rows.length === 0) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule py-16 text-center">
        <div className="text-[14px] text-text mb-2">No projects yet.</div>
        <p className="text-[12px] text-text-dim">
          Convert an accepted quote into a project or create one directly. →{" "}
          <Link href={"/projects/new" as Route} className="text-accent hover:underline">
            New project
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
            <Th>Number</Th>
            <Th>Name</Th>
            <Th>Client</Th>
            <Th>Stage</Th>
            <Th align="right">Value</Th>
            <Th>Expected Install</Th>
            <Th>Created</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              onClick={() => router.push(`/projects/${r.id}` as Route)}
              className="border-b border-rule/70 last:border-0 hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <Td>
                <Link
                  href={`/projects/${r.id}` as Route}
                  onClick={(e) => e.stopPropagation()}
                  className="text-text hover:text-accent tabular"
                >
                  {shortNumber(r.number, "P-")}
                </Link>
              </Td>
              <Td>{r.name}</Td>
              <Td className="text-text-dim">{r.clientName}</Td>
              <Td><ProjectStatusPill status={r.stage} /></Td>
              <Td align="right"><span className="tabular text-text">{formatINR(r.orderValue)}</span></Td>
              <Td className="text-text-dim tabular">{r.expectedInstallAt ? formatDate(r.expectedInstallAt) : "—"}</Td>
              <Td className="text-text-dim tabular">{formatDate(r.createdAt)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-4 h-[34px] font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}
function Td({
  children, align = "left", className = "",
}: { children: React.ReactNode; align?: "left" | "right"; className?: string }) {
  return (
    <td className={`px-4 py-2 ${align === "right" ? "text-right" : "text-left"} ${className}`}>
      {children}
    </td>
  );
}
