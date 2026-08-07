import type { Metadata } from "next";
import { fontClassNames } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mandovara Business OS",
  description:
    "Single business operating system for Mandovara — leads, quotations, inventory, projects, invoicing, WhatsApp.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // suppressHydrationWarning on <html> silences the React warning that fires
  // when browser extensions (MetaMask, WebChatGPT, Grammarly, …) inject
  // attributes like `webcrx=""` onto the html tag after SSR. It scopes the
  // suppression to just this one node — no in-app hydration mismatches are
  // hidden.
  return (
    <html lang="en" className={fontClassNames} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('theme');if(t==='light')document.documentElement.classList.add('light');}catch(e){}",
          }}
        />
      </head>
      <body className="bg-bg text-text font-body">{children}</body>
    </html>
  );
}
