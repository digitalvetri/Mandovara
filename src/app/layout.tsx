import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { fontClassNames } from "@/lib/fonts";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mandovara Business OS",
  description:
    "Single business operating system for Mandovara — leads, quotations, inventory, projects, invoicing, WhatsApp.",
  applicationName: "Mandovara",
  // Next injects <link rel="manifest"> from src/app/manifest.ts, but the icon
  // and iOS hints have to be declared here.
  icons: {
    icon: [
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  // iOS ignores the manifest's display mode; these are what make it open
  // chrome-less from the home screen.
  appleWebApp: {
    capable: true,
    title: "Mandovara",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Do NOT lock zoom — pinch-zoom is an accessibility requirement, and §6.3.11
  // sets an accessibility floor.
  maximumScale: 5,
  viewportFit: "cover",   // respect the notch when installed full-screen
  themeColor: [
    { media: "(prefers-color-scheme: dark)",  color: "#0A1817" },
    { media: "(prefers-color-scheme: light)", color: "#FAFBFB" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  // Studio Porcelain (light) is the default surface: it matches the brand's
  // own world, and a site visit in Coimbatore daylight is the hardest reading
  // condition this app has. Malachite (dark) is opt-in via the toggle.
  const savedTheme = cookieStore.get("theme")?.value;
  const isDark = savedTheme === "dark";
  const htmlClass = isDark ? `${fontClassNames} dark` : fontClassNames;

  // suppressHydrationWarning silences warnings from browser extensions
  // (MetaMask, Grammarly, etc.) that inject attributes onto <html> after SSR.
  return (
    <html lang="en" className={htmlClass} data-theme={isDark ? "dark" : "light"} suppressHydrationWarning>
      <body className="bg-bg text-text font-body" suppressHydrationWarning>
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
