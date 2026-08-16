import { NextResponse } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { devContext } from "@/lib/dev-context";
import { getInvoice } from "@/modules/invoices/queries";
import { InvoicePdf } from "@/app/(app)/invoicing/[id]/_components/InvoicePdf";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await devContext();
  const invoice = await getInvoice(ctx, id);
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const element = React.createElement(InvoicePdf, { invoice }) as ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);
  const bytes = new Uint8Array(buffer);

  // Filename MUST be quoted (per FIXES-01.md §4.2) — unquoted names
  // with spaces / slashes break the download silently in some browsers.
  const safe = invoice.number.replace(/[/\\:*?"<>|]/g, "-");
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Invoice-${safe}.pdf"`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
