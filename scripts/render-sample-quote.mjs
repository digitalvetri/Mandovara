// Render the quotation PDF to a file, with no database and no server.
//
// The quotation layout is specified by two documents the owner supplied
// (VINITHA MAM.pdf, SENTHIL SIR NEELAMBUR.pdf, 2026-08-28). Both are
// rebuilt here as fixtures so anyone changing QuotePdf.tsx can see the
// result against the real thing in seconds:
//
//   npx tsx scripts/render-sample-quote.mjs /tmp/out.pdf vinitha
//   npx tsx scripts/render-sample-quote.mjs /tmp/out.pdf senthil
//
// It also prints the total, which is the useful assertion: the VINITHA
// fixture must come to 33281.25 and the SENTHIL one to 37500 — the
// figures printed on the owner's own documents.

import React from "react";
import { renderToFile, Font } from "@react-pdf/renderer";
import path from "path";
// The component registers these too, but tsx can resolve the renderer to a
// second module instance; registering here guarantees the store this
// renderToFile call reads from actually has the family.
const FONTS = path.join(process.cwd(), "public", "fonts");
Font.register({
  family: "Geist",
  fonts: [
    { src: path.join(FONTS, "GeistRegular.ttf"), fontWeight: "normal" },
    { src: path.join(FONTS, "NotoSans-Bold.ttf"), fontWeight: "bold" },
  ],
});
import { QuotePdf } from "../src/app/(app)/quotations/[id]/_components/QuotePdf.tsx";
import { MARK_SRC } from "../src/assets/mark-base64.ts";

const P = (rupees) => BigInt(Math.round(rupees * 100));
let n = 0;
const line = (description, unit, quantity, rate, discountPct = "0", roomLabel = null) => {
  const gross = Math.round(rate * quantity * 100);
  const taxable = Math.round(gross * (1 - Number(discountPct) / 100));
  return {
    id: `l${++n}`, lineNo: n, colourwayId: null, serviceRateId: null,
    measurementItemId: null, roomLabel, description,
    quantity: String(quantity), unit, rate: P(rate),
    discountPct, taxable: BigInt(taxable), gstRate: "18",
    cgst: 0n, sgst: 0n, igst: 0n, amount: BigInt(taxable),
    isOptional: false, hsn: null, colourHex: null, colourwayCode: null,
  };
};

// Both of the owner's quotations, rebuilt from their PDFs.
const SAMPLES = {
  vinitha: {
    name: "VINITHA MAM", mobile: "93631 26036", area: "Veerakeralam",
    lines: [
      line("MBR MAIN", "MTR", 25, 1099, "25"),
      line("LINING CLOTH", "MTR", 25, 300, "25"),
      line("TRACK", "RFT", 13, 350),
      line("STITCHING CHARGE", "PART", 8, 250),
      line("FITTING CHARGE", "NOS", 2, 250),
    ],
  },
  senthil: {
    name: "SENTHIL SIR", mobile: "96778 70638", area: "Neelambur",
    lines: [
      line("HALL WALL - POINEER - 24907", "ROLLS", 8, 2500, "0", "Wallpaper"),
      line("STAIRCASE WALL - POINEER - 24943", "ROLLS", 7, 2500, "0", "Wallpaper"),
    ],
  },
};
const sample = SAMPLES[process.argv[3] ?? "vinitha"];
const lines = sample.lines;
const taxableAmount = lines.reduce((s, l) => s + l.taxable, 0n);

const quotation = {
  id: "q1", number: "QT-2608-0001", revision: 0, status: "SENT",
  branchId: "b1", branchName: "Coimbatore", supplierStateCode: "33",
  ownerName: "Rohit Vaid", leadId: null, clientId: "c1",
  clientName: sample.name, clientMobile: sample.mobile,
  clientEmail: null, clientGstin: null,
  projectId: "p1", projectName: "Residence", siteArea: sample.area,
  date: new Date("2026-08-28"), validUntil: new Date("2026-09-27"),
  taxableAmount, cgst: 0n, sgst: 0n, igst: 0n, roundOff: 0n,
  total: taxableAmount, termsText: null, shareToken: null,
  shareTokenExpiresAt: null, lines,
};

await renderToFile(
  React.createElement(QuotePdf, { quotation, logoSrc: MARK_SRC }),
  process.argv[2],
);
console.log("total printed (paise):", taxableAmount.toString(), "= ₹", Number(taxableAmount) / 100);
