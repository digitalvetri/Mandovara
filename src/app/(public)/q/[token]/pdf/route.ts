import { NextResponse } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { getQuotationByShareToken } from "@/modules/quotations/public-query";
import { QuotePdf } from "@/app/(app)/quotations/[id]/_components/QuotePdf";
// The butterfly mark. The redesign (2026-08-30) sets the studio's
// identity in type beside it rather than pasting in a photograph of a
// business card, which is what the owner's reference design does.
import { MARK_SRC } from "@/assets/mark-base64";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const q = await getQuotationByShareToken(token);
  if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const element = React.createElement(QuotePdf, { quotation: q, logoSrc: MARK_SRC }) as ReactElement<DocumentProps>;
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
