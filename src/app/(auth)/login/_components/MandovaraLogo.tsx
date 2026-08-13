export function MandovaraLogo() {
  return (
    <div className="flex items-center gap-3">
      {/* Teal leaf icon — replicates the logo from mandovara.com */}
      <svg width="46" height="46" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 36 C 14 26 8 18 11 6 C 17 8 21 20 20 36 Z"  fill="#2BA89A" opacity="0.55" />
        <path d="M20 36 C 17 24 13 16 16 7 C 20 9 21 22 20 36 Z"  fill="#2BA89A" opacity="0.82" />
        <path d="M20 36 C 20 24 19 15 20 4 C 21 15 20 24 20 36 Z"  fill="#2BA89A" />
        <path d="M20 36 C 23 24 27 16 24 7 C 20 9 19 22 20 36 Z"  fill="#2BA89A" opacity="0.82" />
        <path d="M20 36 C 26 26 32 18 29 6 C 23 8 19 20 20 36 Z"  fill="#2BA89A" opacity="0.55" />
      </svg>
      <div>
        <div style={{
          color: "#1A4A45",
          fontFamily: "'Fraunces', Georgia, serif",
          fontSize: 24,
          fontWeight: 600,
          letterSpacing: "0.02em",
          lineHeight: 1,
        }}>
          Mandovara
        </div>
        <div style={{
          color: "#2BA89A",
          fontSize: 9,
          letterSpacing: "0.26em",
          marginTop: 5,
          fontFamily: "'Inter', system-ui, sans-serif",
          fontWeight: 600,
          textTransform: "uppercase",
        }}>
          Interiors
        </div>
      </div>
    </div>
  );
}
