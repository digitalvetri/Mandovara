import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginCard } from "./_components/LoginTabs";
import { MandovaraLogoLight } from "./_components/MandovaraLogo";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const jar = await cookies();
  const cookie = jar.get(SESSION_COOKIE)?.value;
  const uid = await verifySession(cookie);
  if (uid) redirect("/");

  return (
    <div className="min-h-screen flex">

      {/* ─── LEFT: Brand showcase ──────────────────────────────────── */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-sidebar">
        {/* Static brand panel. The three.js scene that used to live here was
            removed: three is not in §2's stack, it shipped ~600KB to a login
            page, and it is decoration rather than function. */}

        {/* Dot-grid texture overlay */}
        <div
          aria-hidden
          className="absolute inset-0 z-[1] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle, color-mix(in oklab, var(--color-accent) 22%, transparent) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Subtle radial glow — bottom */}
        <div
          aria-hidden
          className="absolute inset-0 z-[2] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 45% 85%, color-mix(in oklab, var(--color-accent) 14%, transparent) 0%, transparent 70%)",
          }}
        />

        {/* The same instruments that run down the sidebar rail — so signing in
            reads as the front door of the same building, not a separate page. */}
        <div aria-hidden className="absolute inset-0 z-[2] pointer-events-none chrome-motif" />

        {/* Content */}
        <div className="absolute inset-0 z-[3] flex flex-col justify-between p-10 xl:p-14">

          {/* Top: logo + badge */}
          <div className="rise">
            <MandovaraLogoLight />
            <div
              className="mt-5 inline-flex items-center gap-2 px-3 py-[5px] rounded-full"
              style={{
                background: "color-mix(in oklab, var(--color-accent) 14%, transparent)",
                border: "1px solid color-mix(in oklab, var(--color-accent) 30%, transparent)",
              }}
            >
              <span className="w-[6px] h-[6px] rounded-full bg-accent" />
              <span
                className="text-[10px] font-semibold tracking-[0.18em] uppercase text-accent"
              >
                Studio Console
              </span>
            </div>
          </div>

          {/* Centre: headline + tagline */}
          <div className="rise" style={{ "--d": "90ms" } as React.CSSProperties}>
            <div
              className="text-[10px] font-semibold tracking-[0.26em] uppercase mb-5 text-accent"
            >
              Measure · Quote · Install
            </div>
            <h1
              className="font-display leading-[1.06] tracking-[-0.02em] text-sidebar-text mb-6"
              style={{ fontSize: "clamp(40px, 4.6vw, 58px)", fontWeight: 600 }}
            >
              Exquisite<br />Interior<br />Designers.
            </h1>
            <p
              className="text-[14px] max-w-[320px] leading-[1.7] text-sidebar-dim"
            >
              Measure once on your phone — fabric quantities, roll counts
              and cut lists flow automatically from that single reading.
            </p>
          </div>

          {/* Bottom: the proof strip. Ten years of actual trading, in mono —
              a furnishing house is judged on how much it has hung, not on
              adjectives. Figures are §1.1's, rounded as the business quotes
              them; they are static copy, not a live count. */}
          <div className="rise" style={{ "--d": "180ms" } as React.CSSProperties}>
            <div className="h-px mb-6 on-chrome-rule" />
            <dl className="flex flex-wrap gap-x-12 gap-y-5 mb-7">
              {([
                ["1,200", "projects delivered"],
                ["1,000", "clients"],
                ["22",    "supplier brands"],
              ] as const).map(([figure, caption]) => (
                <div key={caption}>
                  <dt className="font-data text-[22px] leading-none tabular-nums text-sidebar-text">
                    {figure}
                  </dt>
                  <dd className="mt-1.5 text-[10.5px] tracking-[0.04em] text-sidebar-dim">
                    {caption}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="text-[10.5px] tracking-[0.04em] text-sidebar-dim opacity-70">
              32 Thirumoorthy Layout, RS Puram · Coimbatore 641002
            </div>
          </div>
        </div>
      </div>

      {/* ─── RIGHT: Login form ───────────────────────────────────────
             On mobile the whole viewport is this panel — a subtle brand
             wash + a card. LoginCard owns the mark; we do NOT print it
             again outside the card, which was creating a duplicated
             logo and a big empty gap on phones. */}
      <div className="w-full lg:w-[480px] xl:w-[520px] min-h-screen flex flex-col relative">
        {/* Desktop border seam */}
        <div aria-hidden className="hidden lg:block absolute inset-y-0 left-0 w-px bg-[#E0EEEC]" />

        {/* Mobile-only brand wash — a whisper of teal so the login stops
            looking like a blank sheet under a card. Desktop keeps flat #FFF. */}
        <div
          aria-hidden
          className="lg:hidden absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(120% 60% at 50% 0%, rgba(43,168,154,0.09), transparent 55%), radial-gradient(90% 55% at 50% 100%, rgba(43,168,154,0.06), transparent 60%), #F6FBFA",
          }}
        />
        <div aria-hidden className="hidden lg:block absolute inset-0" style={{ background: "#FFFFFF" }} />

        {/* Form — centred vertically, generous mobile padding, safe-area aware. */}
        <div
          className="relative flex-1 flex items-center justify-center px-5 sm:px-8 xl:px-12 pt-8 lg:pt-10 pb-8 lg:pb-10"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0), 24px)" }}
        >
          <Suspense>
            <LoginCard />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

