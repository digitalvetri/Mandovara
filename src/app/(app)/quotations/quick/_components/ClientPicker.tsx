"use client";

// Client-picker step shown when /quotations/quick has no ?client=.
// URL-driven search (`?q=`) — server component upstream re-renders the list.
// Row → deep-links to /quotations/quick?client=<id> so the existing
// QuickQuoteBuilder page picks up seamlessly.

import Link from "next/link";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { ClientRow } from "@/modules/clients/queries";

const TYPE_LABEL: Record<string, string> = {
  HOMEOWNER: "Homeowner", ARCHITECT: "Architect", INTERIOR_DESIGNER: "Interior Designer",
  BUILDER: "Builder", COMMERCIAL: "Commercial", GOVERNMENT: "Government", DEALER: "Dealer",
};

export function ClientPicker({ rows, q }: { rows: ClientRow[]; q: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setValue(q), [q]);

  function onChange(next: string) {
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const p = new URLSearchParams(params.toString());
      if (next.trim()) p.set("q", next.trim()); else p.delete("q");
      router.replace(`/quotations/quick?${p.toString()}` as Route);
    }, 180);
  }

  return (
    <div className="mt-2">
      <div className="rounded-[14px] bg-surface border border-rule p-4 mb-4">
        <label className="text-[11px] uppercase tracking-[0.14em] text-text-dim">
          Pick a client to quote for
        </label>
        <div className="mt-2 flex items-center gap-2 h-[40px] px-3 rounded-[8px] bg-ink border border-rule focus-within:border-accent">
          <Search size={14} className="text-text-dim" />
          <input
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Search by name, mobile, email, or GSTIN…"
            className="flex-1 bg-transparent text-[13px] text-text placeholder:text-text-faint outline-none"
          />
          <Link
            href={"/clients/new" as Route}
            className="text-[11.5px] text-accent hover:underline whitespace-nowrap"
          >
            + New client
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[14px] bg-surface border border-rule py-14 text-center">
          <div className="text-[13.5px] text-text mb-1">No clients match.</div>
          <p className="text-[12px] text-text-dim">
            Refine the search, or{" "}
            <Link href={"/clients/new" as Route} className="text-accent hover:underline">
              add a new client
            </Link>.
          </p>
        </div>
      ) : (
        <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                <Th>Name</Th>
                <Th>Type</Th>
                <Th>Mobile</Th>
                <Th>City</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => router.push(`/quotations/quick?client=${r.id}` as Route)}
                  className="border-b border-rule/70 last:border-0 hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  <Td>
                    <span className="text-text">{r.name}</span>
                    {r.gstin && (
                      <div className="text-[10.5px] tabular text-text-faint">{r.gstin}</div>
                    )}
                  </Td>
                  <Td className="text-text-dim">{TYPE_LABEL[r.type] ?? r.type}</Td>
                  <Td><span className="tabular">{r.mobile}</span></Td>
                  <Td className="text-text-dim">{r.city ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 h-[34px] font-medium text-left">{children}</th>;
}
function Td({
  children, className = "",
}: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2 text-left ${className}`}>{children}</td>;
}
