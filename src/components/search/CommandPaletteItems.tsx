"use client";

import { ArrowRight, Users } from "lucide-react";
import type { SearchHit, SearchKind } from "@/modules/search/actions";

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <div className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-[0.18em] text-text-faint">{title}</div>
      {children}
    </div>
  );
}

export function RowButton({
  active, onMouseEnter, onClick, Icon, title, subtitle,
}: {
  active:       boolean;
  onMouseEnter: () => void;
  onClick:      () => void;
  Icon:         typeof Users;
  title:        string;
  subtitle?:    string;
}) {
  return (
    <button
      type="button"
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
        active ? "bg-surface-hover" : "hover:bg-surface-hover/60"
      }`}
    >
      <Icon size={13} className="text-text-dim shrink-0" strokeWidth={1.75} />
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] text-text truncate">{title}</div>
        {subtitle && (
          <div className="text-[10.5px] text-text-dim tabular truncate">{subtitle}</div>
        )}
      </div>
      <ArrowRight size={11} className={active ? "text-accent" : "text-text-faint opacity-0"} />
    </button>
  );
}

export function groupByKind(hits: readonly SearchHit[]): Map<SearchKind, SearchHit[]> {
  const map = new Map<SearchKind, SearchHit[]>();
  for (const h of hits) {
    const list = map.get(h.kind) ?? [];
    list.push(h);
    map.set(h.kind, list);
  }
  return map;
}
