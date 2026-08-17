import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Mandovara Field",
  description: "Site measurement and installation capture",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mandovara",
  },
};

export const viewport: Viewport = {
  themeColor: "#0F2A28",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
