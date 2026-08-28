"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState, useEffect } from "react";
import { Search } from "lucide-react";

// The Homeowner / Architect / Interior Designer / Builder / Commercial /
// Government / Dealer tab row used to sit here. Removed on the owner's
// instruction (2026-08-28) — eight tabs to narrow a list most studios
// filter by name, and the matching badge beside every client name went
// with it. Client.type is still a field on the record and still set on
// the create and edit forms; it just no longer sorts the screen.

export function ClientFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const currentSearch = params.get("q") ?? "";
  const [search, setSearch] = useState(currentSearch);

  useEffect(() => setSearch(currentSearch), [currentSearch]);

  function push(next: URLSearchParams) {
    startTransition(() => {
      const s = next.toString();
      router.push(s.length > 0 ? `/clients?${s}` : "/clients");
    });
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams(params.toString());
    if (search.trim().length === 0) next.delete("q");
    else next.set("q", search.trim());
    next.delete("page");
    push(next);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <form onSubmit={onSearchSubmit} className="w-full sm:max-w-[420px] min-w-0">
        <label className="flex items-center gap-2 h-[38px] px-3.5 bg-surface border border-rule rounded-[8px] min-w-0">
          <Search size={13} strokeWidth={1.75} className="text-text-faint" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, mobile, email, GSTIN"
            className="flex-1 min-w-0 bg-transparent text-[14px] outline-none placeholder:text-text-faint"
          />
        </label>
      </form>
    </div>
  );
}
