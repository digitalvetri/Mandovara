"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { formatINR } from "@/kernel/money/format";
import type { ClientRow } from "@/modules/clients/queries";

const TYPE_LABEL: Record<string, string> = {
  HOMEOWNER: "Homeowner", ARCHITECT: "Architect", INTERIOR_DESIGNER: "Interior Designer",
  BUILDER: "Builder", COMMERCIAL: "Commercial", GOVERNMENT: "Government", DEALER: "Dealer",
};

export function ClientsTable({ rows }: { rows: ClientRow[] }) {
  const router = useRouter();
  if (rows.length === 0) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule py-16 text-center">
        <div className="text-[14px] text-text mb-2">No clients yet.</div>
        <p className="text-[12px] text-text-dim">
          Add your first client to start building the 360° view. →{" "}
          <Link href={"/clients/new" as Route} className="text-accent hover:underline">
            New client
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
            <Th>Name</Th>
            <Th>Type</Th>
            <Th>Mobile</Th>
            <Th>City</Th>
            <Th align="right">Credit limit</Th>
            <Th align="right">Outstanding</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              onClick={() => router.push(`/clients/${r.id}` as Route)}
              className="border-b border-rule/70 last:border-0 hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <Td>
                <Link
                  href={`/clients/${r.id}` as Route}
                  onClick={(e) => e.stopPropagation()}
                  className="text-text hover:text-accent"
                >
                  {r.name}
                </Link>
                {r.gstin && (
                  <div className="text-[10.5px] tabular text-text-faint">{r.gstin}</div>
                )}
              </Td>
              <Td className="text-text-dim">{TYPE_LABEL[r.type] ?? r.type}</Td>
              <Td><span className="tabular">{r.mobile}</span></Td>
              <Td className="text-text-dim">{r.city ?? "—"}</Td>
              <Td align="right"><span className="tabular text-text">{r.creditLimit ? formatINR(r.creditLimit) : "—"}</span></Td>
              <Td align="right">
                <span className={`tabular ${r.outstanding > 0n ? "text-text" : "text-text-faint"}`}>
                  {r.outstanding > 0n ? formatINR(r.outstanding) : "—"}
                </span>
              </Td>
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
