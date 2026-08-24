import Link from "next/link";
import type { Route } from "next";
import { Download, ArrowLeft, FileText } from "lucide-react";
import { PrimaryButton, Topbar } from "@/components/layout/Topbar";
import { Pager } from "@/components/data/Pager";
import { devContext } from "@/lib/dev-context";
import { listQuotations } from "@/modules/quotations/queries";
import { QUOTATION_STATUSES, type QuotationStatus } from "@/modules/quotations/schema";
import { getProject } from "@/modules/projects/queries";
import { QuotationFilters } from "./_components/QuotationFilters";
import { QuotationsTable } from "./_components/QuotationsTable";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  status?: string;
  project?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: string;
}

export default async function QuotationsPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ctx = await devContext();

  const q         = params.q?.trim() || undefined;
  const status    = normaliseStatus(params.status);
  const projectId = params.project?.trim() || undefined;
  const page      = parsePositiveInt(params.page) ?? 1;
  const dateFrom  = params.dateFrom ? new Date(params.dateFrom) : undefined;
  const dateTo    = params.dateTo ? new Date(params.dateTo + "T23:59:59") : undefined;

  const [{ rows, total, pageSize }, project] = await Promise.all([
    listQuotations(ctx, {
      ...(q ? { search: q } : {}),
      status,
      projectId,
      dateFrom,
      dateTo,
      page,
    }),
    projectId ? getProject(ctx, projectId) : null,
  ]);

  const newQuotationHref = projectId
    ? `/quotations/new?project=${encodeURIComponent(projectId)}`
    : "/quotations/quick";

  // Build export URL with current filters so it matches what's shown on screen
  const exportParams = new URLSearchParams();
  if (q) exportParams.set("q", q);
  if (status !== "ALL") exportParams.set("status", status);
  if (projectId) exportParams.set("project", projectId);
  if (params.dateFrom) exportParams.set("dateFrom", params.dateFrom);
  if (params.dateTo) exportParams.set("dateTo", params.dateTo);
  const exportHref = `/api/quotations/export${exportParams.size > 0 ? `?${exportParams}` : ""}`;

  return (
    <>
      <Topbar
        title={project ? `Quotations — ${project.name}` : "Quotations"}
        eyebrow={
          project
            ? `Quotations for project ${project.number}`
            : "Create, manage and track all customer quotations in one place."
        }
        actions={
          <>
            {project && (
              <Link
                href={`/projects/${project.id}` as Route}
                className="inline-flex items-center gap-1.5 h-[38px] px-4 rounded-[8px]
                           border border-rule bg-surface text-[12.5px] text-text-dim
                           hover:text-text hover:border-accent/60 transition-colors whitespace-nowrap"
              >
                <ArrowLeft size={14} strokeWidth={1.75} />
                Back to project
              </Link>
            )}
            <a
              href={exportHref}
              download
              className="inline-flex items-center gap-1.5 h-[38px] px-4 rounded-[8px]
                         border border-rule bg-surface text-[12.5px] text-text-dim
                         hover:text-text hover:border-accent/60 transition-colors whitespace-nowrap"
            >
              <Download size={14} strokeWidth={1.75} />
              Export
            </a>
            <PrimaryButton href={newQuotationHref as Route}>New Quotation</PrimaryButton>
          </>
        }
      />

      <QuotationFilters projectId={projectId} />

      {rows.length === 0 && projectId ? (
        <div className="rounded-[14px] border border-rule bg-surface py-16 text-center">
          <FileText size={28} className="mx-auto mb-3 text-text-dim/40" strokeWidth={1.5} />
          <div className="text-[13px] text-text-dim">No quotations created for this project yet.</div>
          <div className="mt-1 text-[11.5px] text-text-faint">
            Create the first quotation using the button above — the project and client will be pre-filled.
          </div>
          <Link
            href={newQuotationHref as Route}
            className="mt-4 inline-flex items-center gap-2 rounded-[8px] bg-gold px-5 py-2 text-[12.5px] font-semibold text-ink hover:bg-gold-strong"
          >
            Create Quotation
          </Link>
        </div>
      ) : (
        <>
          <QuotationsTable rows={rows} />
          <Pager page={page} pageSize={pageSize} total={total} />
        </>
      )}
    </>
  );
}

function normaliseStatus(v: string | undefined): QuotationStatus | "ALL" {
  if (v == null || v === "" || v === "ALL") return "ALL";
  if ((QUOTATION_STATUSES as readonly string[]).includes(v)) return v as QuotationStatus;
  return "ALL";
}

function parsePositiveInt(v: string | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}
