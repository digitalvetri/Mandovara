// The identity and party blocks of the on-screen quotation preview.
//
// Mirrors the top half of QuotePdf.tsx — mark, wordmark, tagline,
// contact lines, the ESTIMATE/QUOTATION title with its three meta
// cards, and the client block. Split out on 2026-08-30 so
// QuotePreviewA4 stays under CLAUDE.md §10's line ceiling.
//
// Icons are inline SVG rather than lucide components: this block is
// measured in exact pixels and CSS-zoomed as a unit to fake an A4
// sheet, and the PDF draws the identical paths.

const BRAND      = "#1B8A7E";
const BRAND_DEEP = "#14655C";
const BRAND_TINT = "#EEF7F5";
const INK        = "#1A1A1A";
const INK_SOFT   = "#5B6470";
const RULE       = "#DFE4E8";

function Icon({ d, size = 9, color = BRAND }: { d: string; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth={1.4} style={{ flexShrink: 0 }}>
      <path d={d} />
    </svg>
  );
}

const PHONE = "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z";
const MAIL  = "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM2 7l10 6 10-6";
const PIN   = "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z";
const DOC   = "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5";
const CAL   = "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4";
const CLOCK = "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2";

export function PreviewHeader({
  title, number, date, validUntil, clientName, clientMobile, area,
}: {
  title: string; number: string; date: string; validUntil: string;
  clientName: string; clientMobile: string; area: string;
}) {
  return (
    <>
      {/* ── Identity ── */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "14px" }}>
        <div style={{ width: "54%" }}>
          <img src="/mandovara-mark.png" alt="" style={{ width: "52px", height: "40px", display: "block", marginBottom: "6px" }} />
          <div style={{ fontSize: "22px", fontWeight: 700, color: BRAND_DEEP, marginBottom: "2px" }}>Mandovara</div>
          <div style={{ fontSize: "7.5px", letterSpacing: "2.2px", color: INK_SOFT, marginBottom: "12px" }}>
            PREMIUM WALL COVERINGS
          </div>

          <ContactLine icon={PHONE}>+91 089404 30051</ContactLine>
          <ContactLine icon={MAIL}>mandovara22@gmail.com</ContactLine>
          <ContactLine icon={PIN}>
            32, Thirumurthy Layout, Thadagam Road,<br />R S Puram, Coimbatore - 641 002
          </ContactLine>
        </div>

        <div style={{ width: "42%", paddingLeft: "16px", borderLeft: `0.5px solid ${RULE}` }}>
          <div style={{ fontSize: "25px", color: INK, textAlign: "right", letterSpacing: "0.5px" }}>{title}</div>
          <div style={{ height: "1.6px", width: "78px", background: BRAND, marginLeft: "auto", marginTop: "5px", marginBottom: "12px" }} />
          <MetaCard icon={DOC}   label="QUOTE NO."   value={number} />
          <MetaCard icon={CAL}   label="DATE"        value={date} />
          <MetaCard icon={CLOCK} label="VALID UNTIL" value={validUntil} />
        </div>
      </div>

      <div style={{ height: "0.5px", background: RULE, marginBottom: "13px" }} />

      {/* ── Who and where ── */}
      <div style={{ borderLeft: `2.5px solid ${BRAND}`, paddingLeft: "10px", marginBottom: "13px" }}>
        <div style={{ fontSize: "7.2px", letterSpacing: "1.4px", color: BRAND, marginBottom: "4px" }}>QUOTATION FOR</div>
        <div style={{ fontSize: "17px", fontWeight: 700, color: INK, marginBottom: "4px" }}>{clientName}</div>
        <div style={{ display: "flex", alignItems: "center", fontSize: "8.6px", color: INK }}>
          <Icon d={PHONE} size={8} />
          <span style={{ marginLeft: "5px" }}>{clientMobile}</span>
          {!!area && (
            <>
              <span style={{ width: "0.5px", height: "9px", background: RULE, margin: "0 8px" }} />
              <Icon d={PIN} size={8} />
              <span style={{ marginLeft: "5px" }}>{area}</span>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function ContactLine({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", marginBottom: "5px" }}>
      <span style={{ width: "13px", marginTop: "1px" }}><Icon d={icon} /></span>
      <span style={{ flex: 1, fontSize: "8.2px", color: INK, lineHeight: 1.35 }}>{children}</span>
    </div>
  );
}

function MetaCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: "9px" }}>
      <span style={{
        width: "19px", height: "19px", background: BRAND_TINT, marginRight: "8px",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon d={icon} />
      </span>
      <span>
        <span style={{ display: "block", fontSize: "6.8px", letterSpacing: "1.1px", color: BRAND, marginBottom: "1.5px" }}>{label}</span>
        <span style={{ display: "block", fontSize: "9px", color: INK }}>{value}</span>
      </span>
    </div>
  );
}
