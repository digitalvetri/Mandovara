import React from "react";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { devContext } from "@/lib/dev-context";
import { can } from "@/kernel/rbac/guard";
import { formatINR } from "@/kernel/money/format";
import { getReportKpis } from "@/modules/reports/kpi";
import { leadsBySource, invoiceAgeing, topClientsByRevenue, projectMarginTop } from "@/modules/reports/queries";
import { listFamilyMarginReport } from "@/modules/reports/family";
import { LOGO_SRC } from "@/assets/logo-base64";
import { ReportPdf } from "@/app/(app)/reports/_components/ReportPdf";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  WALK_IN: "Walk-in", PHONE: "Phone", WHATSAPP: "WhatsApp", WEBSITE: "Website",
  INSTAGRAM: "Instagram", ARCHITECT_REFERRAL: "Architect Ref.", CLIENT_REFERRAL: "Client Ref.",
  EXHIBITION: "Exhibition", OTHER: "Other",
};

export async function GET(req: Request) {
  const ctx = await devContext();

  if (!can(ctx, "report.view.sales")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url     = new URL(req.url);
  const fromStr = url.searchParams.get("from");
  const toStr   = url.searchParams.get("to");
  const from    = fromStr ? new Date(fromStr) : undefined;
  const to      = toStr   ? new Date(`${toStr}T23:59:59`) : undefined;
  const periodLabel = fromStr || toStr
    ? `${fromStr ?? "start"} → ${toStr ?? "today"}`
    : "All time";

  const [kpi, leads, ageing, topClients, margins] = await Promise.all([
    getReportKpis(ctx, { from, to }),
    leadsBySource(ctx),
    invoiceAgeing(ctx),
    topClientsByRevenue(ctx, 10),
    projectMarginTop(ctx, 10),
  ]);

  // family-margin requires report.view.projects — gracefully degrade if absent
  let rawCategories: Awaited<ReturnType<typeof listFamilyMarginReport>> = [];
  try { rawCategories = await listFamilyMarginReport(ctx); } catch { /* permission not granted */ }

  const generatedAt = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  const props = {
    periodLabel,
    generatedAt,
    logoSrc: LOGO_SRC,
    kpi: {
      revenue:         formatINR(kpi.revenue),
      collections:     formatINR(kpi.collections),
      outstanding:     formatINR(kpi.outstanding),
      outstandingWarn: kpi.outstanding > 0n,
      activeProjects:  kpi.activeProjects,
      newLeads:        kpi.newLeads,
      readyToInstall:  kpi.readyToInstall,
    },
    leads: leads.map((r) => ({
      label:   SOURCE_LABEL[r.source] ?? r.source,
      won:     r.won,
      total:   r.total,
      convPct: `${(r.conversion * 100).toFixed(0)}%`,
    })),
    ageing: ageing.map((b) => ({
      label:     b.label,
      count:     b.count,
      amount:    formatINR(b.amount),
      fromDays:  b.fromDays,
      hasAmount: b.amount > 0n,
    })),
    topClients: topClients.map((c) => ({
      name:         c.name,
      invoiceCount: c.invoiceCount,
      revenue:      formatINR(c.revenue),
    })),
    margins: margins.map((prj) => ({
      number:     prj.number,
      name:       prj.name,
      clientName: prj.clientName,
      orderValue: formatINR(prj.orderValue),
      margin:     formatINR(prj.margin),
      marginPct:  `${(prj.marginPct * 100).toFixed(0)}%`,
      positive:   prj.margin > 0n,
    })),
    categories: rawCategories
      .filter((f) => f.revenue > 0n)
      .map((f) => ({
        family:    f.family,
        revenue:   formatINR(f.revenue),
        margin:    formatINR(f.margin),
        marginPct: f.marginPct ? f.marginPct + "%" : "—",
        positive:  f.margin > 0n,
      })),
  };

  const element = React.createElement(ReportPdf, props) as ReactElement<DocumentProps>;
  const buffer  = await renderToBuffer(element);
  const safe    = periodLabel.replace(/[^a-zA-Z0-9]+/g, "-").replace(/-+$/, "");

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `attachment; filename="mandovara-report-${safe}.pdf"`,
      "Cache-Control":       "no-store",
    },
  });
}
