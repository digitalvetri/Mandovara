// WCAG 2.1 contrast checker for Sovereign tokens.
// Converts OKLCH → sRGB → relative luminance → contrast ratio and prints a
// matrix of every text-on-background pair the design system actually uses.
//
// Reference:
//   OKLCH → sRGB via OKLab (Björn Ottosson)
//   WCAG 2.1: https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio

type Triple = [number, number, number];

function oklchToOklab(l: number, c: number, hDeg: number): Triple {
  const h = (hDeg * Math.PI) / 180;
  return [l, c * Math.cos(h), c * Math.sin(h)];
}

// OKLab → linear sRGB
function oklabToLinearSrgb([l, a, b]: Triple): Triple {
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l_ ** 3;
  const m3 = m_ ** 3;
  const s3 = s_ ** 3;

  return [
    +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ];
}

function linearToSrgb(v: number): number {
  const clamped = Math.max(0, Math.min(1, v));
  return clamped <= 0.0031308
    ? 12.92 * clamped
    : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
}

function oklchToSrgb(l: number, c: number, h: number): Triple {
  const [r, g, b] = oklabToLinearSrgb(oklchToOklab(l, c, h));
  return [linearToSrgb(r), linearToSrgb(g), linearToSrgb(b)];
}

function toHex([r, g, b]: Triple): string {
  const to255 = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  return (
    "#" +
    to255(r).toString(16).padStart(2, "0") +
    to255(g).toString(16).padStart(2, "0") +
    to255(b).toString(16).padStart(2, "0")
  ).toUpperCase();
}

// WCAG relative luminance (from linear sRGB)
function relLuminance([r, g, b]: Triple): number {
  const linearize = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrast(fg: Triple, bg: Triple): number {
  const lf = relLuminance(fg);
  const lb = relLuminance(bg);
  const [L1, L2] = lf > lb ? [lf, lb] : [lb, lf];
  return (L1 + 0.05) / (L2 + 0.05);
}

// ── Sovereign palette ─────────────────────────────────────────────
type Token = { name: string; l: number; c: number; h: number };

const tokens: Token[] = [
  { name: "ink",         l: 0.18, c: 0.045, h: 265 },
  { name: "ink-raised",  l: 0.24, c: 0.042, h: 265 },
  { name: "ink-hover",   l: 0.28, c: 0.045, h: 265 },
  { name: "ink-sunken",  l: 0.14, c: 0.04,  h: 265 },
  { name: "rule",        l: 0.36, c: 0.038, h: 265 },
  { name: "gold",        l: 0.72, c: 0.115, h: 85  },
  { name: "gold-lit",    l: 0.83, c: 0.105, h: 85  },
  { name: "gold-dim",    l: 0.55, c: 0.09,  h: 85  },
  { name: "paper",       l: 0.94, c: 0.008, h: 265 },
  { name: "paper-dim",   l: 0.68, c: 0.028, h: 265 },
  { name: "paper-faint", l: 0.5,  c: 0.03,  h: 265 },
  { name: "signal",      l: 0.78, c: 0.145, h: 165 },
  { name: "alarm",       l: 0.66, c: 0.19,  h: 20  },
  { name: "caution",     l: 0.78, c: 0.13,  h: 75  },
];

const byName = new Map(tokens.map((t) => [t.name, oklchToSrgb(t.l, t.c, t.h)]));
const hexByName = new Map([...byName.entries()].map(([n, rgb]) => [n, toHex(rgb)]));

// The backgrounds the app actually uses
const backgrounds = ["ink", "ink-raised", "ink-hover", "ink-sunken"];
// The foregrounds paired against them
const foregrounds = [
  "paper", "paper-dim", "paper-faint",
  "gold", "gold-lit", "gold-dim",
  "signal", "alarm", "caution",
];

// AA thresholds:
//   normal text (< 18px regular or < 14px bold):  4.5:1
//   large text  (>= 18px regular or >= 14px bold): 3.0:1
// We evaluate against normal-text 4.5:1 for the strictest read.

const AA_NORMAL = 4.5;
const AA_LARGE = 3.0;

interface Row {
  fg: string; bg: string; ratio: number; pass: boolean; largePass: boolean;
}

const rows: Row[] = [];
for (const bg of backgrounds) {
  for (const fg of foregrounds) {
    const fgRgb = byName.get(fg);
    const bgRgb = byName.get(bg);
    if (!fgRgb || !bgRgb) continue;
    const r = contrast(fgRgb, bgRgb);
    rows.push({ fg, bg, ratio: r, pass: r >= AA_NORMAL, largePass: r >= AA_LARGE });
  }
}

// ── Print ────────────────────────────────────────────────────────
function pad(s: string, n: number): string { return s.length >= n ? s : s + " ".repeat(n - s.length); }

process.stdout.write("\nSovereign palette — sRGB approximations from OKLCH\n");
process.stdout.write("=".repeat(48) + "\n");
for (const [name, hex] of hexByName) {
  process.stdout.write(pad(name, 14) + " " + hex + "\n");
}

process.stdout.write("\nWCAG 2.1 contrast — text-on-background pairs\n");
process.stdout.write("=".repeat(72) + "\n");
process.stdout.write(pad("foreground", 14) + pad("background", 14) + pad("ratio", 10) + pad("AA normal", 12) + "AA large\n");
process.stdout.write("-".repeat(72) + "\n");

const failsNormal: Row[] = [];
const failsLarge: Row[] = [];

for (const r of rows) {
  const line =
    pad(r.fg, 14) +
    pad(r.bg, 14) +
    pad(r.ratio.toFixed(2) + ":1", 10) +
    pad(r.pass ? "PASS" : "FAIL", 12) +
    (r.largePass ? "PASS" : "FAIL") +
    "\n";
  process.stdout.write(line);
  if (!r.pass) failsNormal.push(r);
  if (!r.largePass) failsLarge.push(r);
}

process.stdout.write("\nSummary\n");
process.stdout.write("=".repeat(48) + "\n");
process.stdout.write(`Total pairs: ${rows.length}\n`);
process.stdout.write(`AA normal (4.5:1) failures: ${failsNormal.length}\n`);
process.stdout.write(`AA large  (3.0:1) failures: ${failsLarge.length}\n`);

// Specific check the KIT calls out:
//   "Confirm --color-paper-dim passes at 11px; if it does not, raise its lightness."
// 11px is small text → AA normal threshold (4.5:1). Evaluated on ink (ground).
const dimOnInk = rows.find((r) => r.fg === "paper-dim" && r.bg === "ink");
if (dimOnInk) {
  process.stdout.write("\nCritical: paper-dim @ 11px on ink ground\n");
  process.stdout.write(`  ratio: ${dimOnInk.ratio.toFixed(2)}:1  →  AA normal ${dimOnInk.pass ? "PASS" : "FAIL"}\n`);
}

if (failsNormal.length > 0) {
  process.exit(1);
}
