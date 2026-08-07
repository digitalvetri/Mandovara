import { Fraunces, Inter, Geist_Mono, Noto_Sans_Tamil } from "next/font/google";

// Display — Fraunces. Login wordmark, page titles, KPI hero numbers.
export const fontDisplay = Fraunces({
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
  display: "swap",
  variable: "--font-display",
});

// Body — Inter. UI at 13px base.
export const fontBody = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

// Data — Geist Mono. Every numeral, tabular-nums.
export const fontData = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-data",
});

// Tamil — Noto Sans Tamil. Field surfaces, payslips, WA previews.
export const fontTamil = Noto_Sans_Tamil({
  subsets: ["tamil"],
  display: "swap",
  variable: "--font-tamil",
});

export const fontClassNames = [
  fontDisplay.variable,
  fontBody.variable,
  fontData.variable,
  fontTamil.variable,
].join(" ");
