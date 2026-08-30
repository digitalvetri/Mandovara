// Matches the actual Mandovara brand logo: the butterfly mark + bold teal "Mandovara™" text.
// Same PNG used by the authenticated app shell (GlobalTopbar, Sidebar).
//
// Sized by height, not into a square box — the mark is 1.31:1, so a
// square with objectFit: contain letterboxed it and made it look small.

// ── Right-panel variant: teal text on white ───────────────────────────────────
export function MandovaraLogo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <img
        src="/mandovara-icon.png"
        alt="Mandovara"
        height={52}
        style={{ height: 52, width: "auto", display: "block" }}
      />
      <div style={{
        color: "#2BA89A",
        fontFamily: "'Fraunces', Georgia, serif",
        fontSize: 28,
        fontWeight: 700,
        letterSpacing: "0.01em",
        lineHeight: 1,
      }}>
        Mandovara
        <sup style={{
          fontSize: 12,
          fontFamily: "'Inter', system-ui, sans-serif",
          fontWeight: 400,
          verticalAlign: "super",
          letterSpacing: 0,
          marginLeft: 2,
          color: "#5A7A78",
        }}>™</sup>
      </div>
    </div>
  );
}

// ── Left-panel variant: white text on dark background ────────────────────────
export function MandovaraLogoLight() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <img
        src="/mandovara-icon.png"
        alt="Mandovara"
        height={44}
        style={{ height: 44, width: "auto", display: "block" }}
      />
      <div style={{
        color: "#FFFFFF",
        fontFamily: "'Fraunces', Georgia, serif",
        fontSize: 24,
        fontWeight: 700,
        letterSpacing: "0.01em",
        lineHeight: 1,
      }}>
        Mandovara
        <sup style={{
          fontSize: 11,
          fontFamily: "'Inter', system-ui, sans-serif",
          fontWeight: 400,
          verticalAlign: "super",
          letterSpacing: 0,
          marginLeft: 2,
          color: "rgba(255,255,255,0.5)",
        }}>™</sup>
      </div>
    </div>
  );
}
