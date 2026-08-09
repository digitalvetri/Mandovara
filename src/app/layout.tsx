import type { Metadata } from "next";
import { cookies } from "next/headers";
import { fontClassNames } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mandovara Business OS",
  description:
    "Single business operating system for Mandovara — leads, quotations, inventory, projects, invoicing, WhatsApp.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const savedTheme = cookieStore.get("theme")?.value;
  const htmlClass = savedTheme === "light"
    ? `${fontClassNames} light`
    : fontClassNames;

  // suppressHydrationWarning silences warnings from browser extensions
  // (MetaMask, Grammarly, etc.) that inject attributes onto <html> after SSR.
  return (
    <html lang="en" className={htmlClass} suppressHydrationWarning>
      <body className="bg-bg text-text font-body">{children}</body>
    </html>
  );
}
