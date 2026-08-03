import { Fraunces, Inter, JetBrains_Mono, Noto_Sans_Tamil } from "next/font/google";

// Display — Fraunces variable. Used ONLY for login wordmark, page titles,
// dashboard hero numbers. Nowhere else.
export const fontDisplay = Fraunces({
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
  display: "swap",
  variable: "--font-display",
});

// Body — Inter. Warm, soft sans-serif matching the approved reference.
export const fontBody = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

// Data — JetBrains Mono. Every numeral in tables and technical fields.
export const fontData = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-data",
});

// Tamil — Noto Sans Tamil. Bilingual labels, WhatsApp template previews, payslips.
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
