// The terms block of the on-screen quotation preview.
//
// Split out of QuotePreviewA4 on 2026-08-30 when the redesign pushed
// that file past CLAUDE.md §10's 300-line ceiling. Mirrors the terms
// section of QuotePdf.tsx — same content, same order, same emphasis.

import { ESTIMATE_CAVEAT } from "@/modules/quotations/lib";
import {
  MANDOVARA_TERMS, EMPHASISED_TERM, CANCELLATION_HEADING,
  CANCELLATION_TERMS, CLOSING_LINES,
} from "./_quote-terms";

const BRAND_DEEP = "#14655C";
const BRAND_TINT = "#EEF7F5";
const INK        = "#1A1A1A";
const INK_SOFT   = "#5B6470";
const RULE       = "#DFE4E8";

export function PreviewTerms({
  estimate, customTerms,
}: { estimate: boolean; customTerms: string[] | null }) {
  return (
  <div style={{ borderTop: `0.5px solid ${RULE}`, paddingTop: "10px" }}>
    {estimate && (
      <div style={{
        fontSize: "8.5px", fontWeight: 700, color: BRAND_DEEP,
        background: BRAND_TINT, padding: "6px 9px", marginBottom: "10px",
      }}>
        {ESTIMATE_CAVEAT}
      </div>
    )}

    <div style={{ fontSize: "7.5px", fontWeight: 700, color: BRAND_DEEP, letterSpacing: "1.3px", marginBottom: "6px" }}>
      TERMS &amp; CONDITIONS
    </div>
    {(customTerms ?? MANDOVARA_TERMS).map((t, i) => (
      <div key={i} style={{ display: "flex", marginBottom: "3.2px" }}>
        <span style={{ width: "12px", fontSize: "7.6px", color: INK_SOFT, flexShrink: 0 }}>{i + 1}.</span>
        <span style={{
          flex: 1, fontSize: "7.6px", lineHeight: 1.42,
          ...(!customTerms && i === EMPHASISED_TERM
            ? { color: BRAND_DEEP, fontWeight: 700 }
            : { color: INK }),
        }}>
          {t}
        </span>
      </div>
    ))}

    {!customTerms && (
      <>
        <div style={{ fontSize: "7.5px", fontWeight: 700, color: BRAND_DEEP, letterSpacing: "1.3px", marginTop: "9px", marginBottom: "6px" }}>
          {CANCELLATION_HEADING.toUpperCase()}
        </div>
        {CANCELLATION_TERMS.map((t, i) => (
          <div key={i} style={{ display: "flex", marginBottom: "3.2px" }}>
            <span style={{ width: "12px", fontSize: "7.6px", color: INK_SOFT, flexShrink: 0 }}>{i + 1}.</span>
            <span style={{ flex: 1, fontSize: "7.6px", lineHeight: 1.42, color: INK }}>{t}</span>
          </div>
        ))}
        {CLOSING_LINES.map((t, i) => (
          <div key={i} style={{ fontSize: "7.6px", color: INK_SOFT, lineHeight: 1.42, marginTop: "2.5px" }}>{t}</div>
        ))}
      </>
    )}
  </div>
  );
}
