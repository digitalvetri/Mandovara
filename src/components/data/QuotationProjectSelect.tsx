"use client";

// The Project cell of a client's Quotations table, as a picker: put this
// quotation on one of the client's projects. assignQuotationToProject
// decides whether the move is allowed and says why when it is not.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { assignQuotationToProject } from "@/modules/quotations/actions-project";

export interface ProjectChoice {
  id:   string;
  name: string;
}

export function QuotationProjectSelect({
  quotationId, projectId, projects,
}: {
  quotationId: string;
  projectId:   string | null;
  projects:    ProjectChoice[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(projectId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start]  = useTransition();

  function change(next: string): void {
    if (!next || next === value) return;
    const previous = value;
    setValue(next);
    setError(null);
    start(async () => {
      const res = await assignQuotationToProject({ quotationId, projectId: next });
      if (!res.ok) {
        setValue(previous);
        setError(res.error ?? "Could not move the quotation");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="max-w-[240px]">
      <div className="relative">
        <select
          value={value}
          onChange={(e) => change(e.target.value)}
          disabled={pending}
          aria-label="Project this quotation belongs to"
          className={`h-8 w-full truncate rounded-[6px] border bg-transparent pl-2 pr-7 text-[12.5px] outline-none transition-colors focus:border-gold disabled:opacity-60 ${
            value ? "border-rule text-text" : "border-warn/60 text-warn"
          }`}
        >
          {!value && <option value="">Choose a project…</option>}
          {/* The current project stays listed even if it is no longer
              offered (e.g. cancelled), so the cell never reads blank. */}
          {projectId && !projects.some((p) => p.id === projectId) && (
            <option value={projectId} disabled>Current project</option>
          )}
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {pending && (
          <Loader2 size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-text-dim" />
        )}
      </div>
      {error && <div className="mt-1 whitespace-normal text-[11px] leading-snug text-fault">{error}</div>}
    </div>
  );
}
