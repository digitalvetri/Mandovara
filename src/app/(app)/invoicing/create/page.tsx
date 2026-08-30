// Write an invoice by hand, for one project.
//
// Reached from the project page — its Quick actions strip and the
// Create invoice control on the Payment ledger both land here
// (owner, 2026-08-30: "i want to create invoice by myself").
//
// Lines are seeded from the project's current quotation because that is
// nearly always the starting point, and retyping five lines to bill what
// was quoted is work for its own sake. Everything is editable, so the
// seed is a convenience rather than a constraint.

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { ManualInvoiceBuilder, type SeedLine } from "./_components/ManualInvoiceBuilder";

export const dynamic = "force-dynamic";

interface SearchParams { project?: string }

export default async function CreateInvoicePage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ctx = await devContext();
  requirePermission(ctx, "invoice.create");

  const projectId = params.project?.trim();
  if (!projectId) notFound();

  const db = scoped(ctx);
  const project = await db.project.findUnique({
    where:  { id: projectId },
    select: { id: true, name: true, number: true, clientId: true },
  });
  if (!project) notFound();

  const client = await db.client.findUnique({
    where: { id: project.clientId }, select: { name: true },
  });

  // Newest quotation that has not been rejected — the current price.
  const quote = await db.quotation.findFirst({
    where:   { projectId: project.id, status: { not: "REJECTED" } },
    orderBy: [{ date: "desc" }, { revision: "desc" }],
    select: {
      number: true,
      lines: {
        orderBy: { lineNo: "asc" },
        select: {
          description: true, unit: true, quantity: true,
          rate: true, gstRate: true,
        },
      },
    },
  });

  const seed: SeedLine[] = (quote?.lines ?? []).map((l) => ({
    description: l.description,
    unit:        l.unit as string,
    quantity:    l.quantity.toString(),
    // Paise → rupees for a field a human types into.
    rate:        (Number(l.rate) / 100).toString(),
    gstRate:     Number(l.gstRate),
  }));

  return (
    <>
      <Topbar
        title=""
        eyebrow={`${project.number} · ${client?.name ?? "Client"}`}
      />

      <div className="mb-4">
        <Link
          href={`/projects/${project.id}` as Route}
          className="inline-flex items-center gap-1.5 text-[12px] uppercase tracking-[0.1em] text-text-dim transition-colors hover:text-text"
        >
          <ArrowLeft size={12} /> Back to project
        </Link>
        <h1 className="mt-2 font-display text-[28px] font-semibold leading-none text-text">
          New invoice
        </h1>
      </div>

      <ManualInvoiceBuilder
        projectId={project.id}
        projectName={project.name}
        clientName={client?.name ?? "—"}
        seed={seed}
        seededFrom={seed.length > 0 ? (quote?.number ?? null) : null}
      />
    </>
  );
}
