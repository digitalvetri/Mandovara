import { NextResponse } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { devContext } from "@/lib/dev-context";
import { getPO } from "@/modules/purchase/queries";
import { POPdf } from "@/app/(app)/purchase/[id]/_components/POPdf";
import { LOGO_SRC } from "@/assets/logo-base64";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await devContext();
  const po = await getPO(ctx, id);
  if (!po) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const element = React.createElement(POPdf, { po, logoSrc: LOGO_SRC }) as ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);
  const bytes = new Uint8Array(buffer);

  const safe = po.number.replace(/[/\\:*?"<>|]/g, "-");
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="PurchaseOrder-${safe}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
