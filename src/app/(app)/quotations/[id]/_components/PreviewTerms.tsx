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

const BRAND      = "#1B8A7E";
const BRAND_DEEP = "#14655C";
const BRAND_TINT = "#EEF7F5";
const INK        = "#1A1A1A";
const RULE       = "#DFE4E8";

export function PreviewTerms({
  estimate, customTerms,
}: { estimate: boolean; customTerms: string[] | null }) {
  return (
    <>
      {estimate && (
        <div style={{
          display: "flex", alignItems: "center", gap: "8px",
          background: BRAND_TINT, padding: "8px 11px", marginBottom: "14px",
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="1.4" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" strokeWidth="1.8" />
          </svg>
          <span style={{ fontSize: "8.4px", color: BRAND_DEEP, lineHeight: 1.35 }}>{ESTIMATE_CAVEAT}</span>
        </div>
      )}

      {/* Two columns, as the PDF sets them — the same clauses read in
          half the height, which is what keeps the sheet to one page. */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div style={{ width: "47.5%" }}>
          <Heading title="TERMS & CONDITIONS" />
          {(customTerms ?? MANDOVARA_TERMS).map((t, i) => (
            <Clause key={i} n={i + 1} strong={!customTerms && i === EMPHASISED_TERM}>{t}</Clause>
          ))}
        </div>
        <div style={{ width: "47.5%" }}>
          {!customTerms && (
            <>
              <Heading title={CANCELLATION_HEADING.toUpperCase()} />
              {CANCELLATION_TERMS.map((t, i) => <Clause key={i} n={i + 1}>{t}</Clause>)}
            </>
          )}
        </div>
      </div>

      {!customTerms && (
        <div style={{
          display: "flex", alignItems: "center", gap: "11px",
          border: `0.5px solid ${RULE}`, padding: "10px 12px", marginTop: "14px",
        }}>
          <span style={{
            width: "24px", height: "24px", borderRadius: "12px", background: BRAND,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.4">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5" />
            </svg>
          </span>
          <span style={{ flex: 1 }}>
            {CLOSING_LINES.map((t, i) => (
              <span key={i} style={{ display: "block", fontSize: "7.6px", color: INK, lineHeight: 1.5, marginBottom: "1.5px" }}>{t}</span>
            ))}
          </span>
        </div>
      )}
    </>
  );
}

function Heading({ title }: { title: string }) {
  return (
    <div style={{ marginBottom: "8px" }}>
      <div style={{ fontSize: "8.4px", fontWeight: 700, color: BRAND, letterSpacing: "0.7px" }}>{title}</div>
      <div style={{ height: "1.4px", width: "34px", background: BRAND, marginTop: "4px" }} />
    </div>
  );
}

function Clause({ n, children, strong }: { n: number; children: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", marginBottom: "4.5px" }}>
      <span style={{ width: "13px", fontSize: "7.4px", color: BRAND, flexShrink: 0 }}>{n}.</span>
      <span style={{
        flex: 1, fontSize: "7.4px", lineHeight: 1.45,
        ...(strong ? { color: BRAND_DEEP, fontWeight: 700 } : { color: INK }),
      }}>{children}</span>
    </div>
  );
}
