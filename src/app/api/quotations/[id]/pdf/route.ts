import { NextResponse } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { devContext } from "@/lib/dev-context";
import { getQuotation } from "@/modules/quotations/queries";
import { QuotePdf } from "@/app/(app)/quotations/[id]/_components/QuotePdf";
// The butterfly mark. The redesign (2026-08-30) sets the studio's
// identity in type beside it rather than pasting in a photograph of a
// business card, which is what the owner's reference design does.
import { MARK_SRC } from "@/assets/mark-base64";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await devContext();
  const q = await getQuotation(ctx, id);
  if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const logoSrc = MARK_SRC;
  const element = React.createElement(QuotePdf, { quotation: q, logoSrc }) as ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);
  const bytes = new Uint8Array(buffer);

  const safe = q.number.replace(/[/\\:*?"<>|]/g, "-");
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Quotation-${safe}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
