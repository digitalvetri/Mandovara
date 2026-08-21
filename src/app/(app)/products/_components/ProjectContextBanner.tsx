// Shown on /products/[id] when opened from inside a project (via ?forProject={id}).
// Anchors the user's context — Back-to-project link on the right.

import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft } from "lucide-react";

interface Props {
  projectId:   string;
  projectName: string;
  itemLabel?:  string | null;
}

export function ProjectContextBanner({ projectId, projectName, itemLabel }: Props) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-[10px] border border-gold/40 bg-gold-tint px-4 py-2.5">
      <div className="text-[12px] text-text min-w-0">
        <span className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim mr-2">
          {itemLabel ? "Selecting for" : "Browsing for"}
        </span>
        <span className="font-medium">{projectName}</span>
        {itemLabel && (
          <>
            <span className="mx-2 text-text-dim">→</span>
            <span className="font-medium">{itemLabel}</span>
          </>
        )}
      </div>
      <Link
        href={`/projects/${projectId}` as Route}
        className="inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-[11.5px] text-text-dim hover:text-text hover:bg-surface/60 shrink-0"
      >
        <ArrowLeft size={11} />
        Back to project
      </Link>
    </div>
  );
}
