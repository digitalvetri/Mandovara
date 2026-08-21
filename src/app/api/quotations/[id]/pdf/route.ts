import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { devContext } from "@/lib/dev-context";
import { getQuotation } from "@/modules/quotations/queries";
import { QuotePdf } from "@/app/(app)/quotations/[id]/_components/QuotePdf";

export const dynamic = "force-dynamic";

function readLogoSrc(): string | undefined {
  const candidates: [string, string][] = [
    ["mandovara-logo.png", "image/png"],
    ["mandovara-logo.jpg", "image/jpeg"],
  ];
  for (const [file, mime] of candidates) {
    const p = path.join(process.cwd(), "public", file);
    if (fs.existsSync(p)) {
      return `data:${mime};base64,${fs.readFileSync(p).toString("base64")}`;
    }
  }
  return undefined;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await devContext();
  const q = await getQuotation(ctx, id);
  if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const logoSrc = readLogoSrc();
  const element = React.createElement(QuotePdf, { quotation: q, logoSrc }) as ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);
  const bytes = new Uint8Array(buffer);

  const safe = q.number.replace(/[/\\:*?"<>|]/g, "-");
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Quotation-${safe}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
