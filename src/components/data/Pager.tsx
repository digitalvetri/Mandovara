"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PagerProps {
  page: number;
  pageSize: number;
  total: number;
}

// Path-agnostic pager. Reads current pathname + search params from the router
// so it works on /leads, /clients, /invoicing, etc. without any per-page wiring.

export function Pager({ page, pageSize, total }: PagerProps) {
  const pathname = usePathname();
  const params = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages === 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  function hrefFor(p: number): string {
    const next = new URLSearchParams(params.toString());
    if (p <= 1) next.delete("page");
    else next.set("page", String(p));
    const s = next.toString();
    return s.length > 0 ? `${pathname}?${s}` : pathname;
  }

  return (
    <div className="mt-4 flex items-center justify-between">
      <div className="text-[11.5px] text-text-dim tabular">
        {from}–{to} of {total}
      </div>
      <div className="flex items-center gap-1">
        <PagerLink href={hrefFor(page - 1)} disabled={page <= 1} icon={<ChevronLeft size={14} />} label="Previous" />
        <div className="tabular text-[12px] text-text px-3">
          Page <span>{page}</span> / <span>{totalPages}</span>
        </div>
        <PagerLink href={hrefFor(page + 1)} disabled={page >= totalPages} icon={<ChevronRight size={14} />} label="Next" />
      </div>
    </div>
  );
}

function PagerLink({
  href, disabled, icon, label,
}: { href: string; disabled: boolean; icon: React.ReactNode; label: string }) {
  const cls = "h-[30px] w-[30px] grid place-items-center rounded-[6px] border border-rule text-text-dim";
  if (disabled) {
    return (
      <span className={`${cls} opacity-40 cursor-not-allowed`} aria-hidden>
        {icon}
      </span>
    );
  }
  return (
    <Link
      href={href as Route}
      aria-label={label}
      className={`${cls} hover:bg-surface-hover hover:text-text transition-colors`}
    >
      {icon}
    </Link>
  );
}
