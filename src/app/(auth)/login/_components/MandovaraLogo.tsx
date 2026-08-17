// Matches the actual Mandovara brand logo: /mandovara-mark.png icon + bold teal "Mandovara™" text.
// Same PNG used by the authenticated app shell (GlobalTopbar, Sidebar).

// ── Right-panel variant: teal text on white ───────────────────────────────────
export function MandovaraLogo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <img
        src="/mandovara-mark.png"
        alt="Mandovara"
        width={52}
        height={52}
        style={{ width: 52, height: 52, objectFit: "contain" }}
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
        src="/mandovara-mark.png"
        alt="Mandovara"
        width={44}
        height={44}
        style={{ width: 44, height: 44, objectFit: "contain" }}
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
