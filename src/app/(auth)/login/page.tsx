import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginCard } from "./_components/LoginTabs";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export const dynamic = "force-dynamic";

// Sign-in.
//
// Owner, 2026-08-31: "the login page UI is very very bad ... bring a
// wonderful background and use glass morphism for login form and also use
// animations".
//
// This replaced a two-column split — a dark marketing panel on the left,
// a white card on a near-white ground on the right — that only worked on a
// wide desktop. On a phone the left half was `hidden lg:flex`, so the whole
// design collapsed to a card floating on almost-white nothing, which is
// what the complaint was about.
//
// One canvas instead, at every width: the brand teal drifting slowly over
// the dark rail colour, with the form on frosted glass in the middle. The
// studio's claims that used to fill the left column now sit under the card,
// where a phone gets them too rather than only a laptop.
//
// The glass is LIGHT. A dark translucent panel would look moodier, but every
// colour inside the form — labels, field text, the error state — is solved
// against a light ground for §6.2's 4.5:1 floor, and tinting the glass dark
// breaks all of them at once. Frosted white keeps the contrast and still
// reads as glass.

const CLAIMS = [
  { figure: "1,200", caption: "projects delivered" },
  { figure: "1,000", caption: "clients" },
  { figure: "22",    caption: "supplier brands" },
];

export default async function LoginPage() {
  const jar = await cookies();
  const cookie = jar.get(SESSION_COOKIE)?.value;
  const uid = await verifySession(cookie);
  if (uid) redirect("/");

  return (
    <div className="auth-canvas relative min-h-screen overflow-hidden">
      {/* ── The moving ground ───────────────────────────────────────
          Three blurred pools of brand colour, drifting on a 28–40s cycle.
          Painted only: aria-hidden, pointer-events-none, and stopped
          entirely for anyone who asks for reduced motion. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="auth-aurora auth-aurora-1" />
        <div className="auth-aurora auth-aurora-2" />
        <div className="auth-aurora auth-aurora-3" />
      </div>

      {/* The instrument motif off the sidebar rail, so signing in reads as
          the front door of the same building. */}
      <div aria-hidden className="chrome-motif pointer-events-none absolute inset-0" />

      {/* Accent dot-grid, the same texture the old desktop panel carried. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, color-mix(in oklab, var(--color-accent) 18%, transparent) 1px, transparent 1px)",
          backgroundSize: "30px 30px",
        }}
      />

      {/* A vignette so the card's edges have something to sit against. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 95% 80% at 50% 45%, transparent 55%, rgba(4, 18, 17, 0.38) 100%)",
        }}
      />

      {/* ── The form ────────────────────────────────────────────────── */}
      <div
        className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-6"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 40px)" }}
      >
        <div className="rise w-full max-w-[440px]">
          <div className="auth-glass rounded-[20px] p-6 sm:p-8">
            <Suspense>
              <LoginCard />
            </Suspense>
          </div>
        </div>

        {/* What the studio does, moved out of the desktop-only column so a
            phone sees it too. */}
        <div
          className="rise mt-8 w-full max-w-[440px]"
          style={{ "--d": "160ms" } as React.CSSProperties}
        >
          <dl className="flex flex-wrap items-baseline justify-center gap-x-9 gap-y-4">
            {CLAIMS.map(({ figure, caption }) => (
              <div key={caption} className="text-center">
                <dt className="font-data text-[20px] leading-none tabular-nums text-sidebar-text">
                  {figure}
                </dt>
                <dd className="mt-1.5 text-[10.5px] tracking-[0.06em] text-sidebar-dim">
                  {caption}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-center text-[10.5px] tracking-[0.04em] text-sidebar-dim opacity-70">
            32 Thirumoorthy Layout, RS Puram &middot; Coimbatore 641002
          </p>
        </div>
      </div>
    </div>
  );
}
