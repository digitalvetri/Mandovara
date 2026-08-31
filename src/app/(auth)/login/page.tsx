import { Suspense } from "react";
import { ClipboardCheck, Users, Award, MapPin } from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginCard } from "./_components/LoginTabs";
import { MandovaraLogoLight } from "./_components/MandovaraLogo";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export const dynamic = "force-dynamic";

// Sign-in.
//
// Two designs, and deliberately so.
//
// Desktop keeps the split the owner asked to have back (2026-08-31: "the old
// design for the desktop is fine"): the brand panel on the left, the form on
// a clean light panel to its right. A wide screen has room to say who this
// is before asking for a password, and the previous full-bleed version threw
// that away to solve a problem desktop never had.
//
// Mobile keeps the canvas built on 2026-08-31, because the complaint that
// started this was a phone one: the left panel is `hidden lg:flex`, so on a
// handset the old design collapsed to a white card floating on almost-white
// nothing. There it is brand colour drifting under frosted glass.
//
// The drifting pools are new on both. On desktop they replaced a pair of
// static gradients in the same place, doing the same job with movement — the
// part of the rework worth keeping at every width.
//
// The glass is LIGHT, not smoked. Every colour inside the form — labels,
// field text, the error state — is solved against a light ground for §6.2's
// 4.5:1 floor; tinting the panel dark would break all of them at once.

// The proof strip. Ten years of actual trading — a furnishing house is
// judged on how much it has hung, not on adjectives. Static copy, not a
// live count, so the figures carry a "+" rather than pretending to be exact.
const CLAIMS = [
  { Icon: ClipboardCheck, figure: "1,200+", caption: "Projects Delivered" },
  { Icon: Users,          figure: "1,000+", caption: "Happy Clients" },
  { Icon: Award,          figure: "22+",    caption: "Supplier Brands" },
];

export default async function LoginPage() {
  const jar = await cookies();
  const cookie = jar.get(SESSION_COOKIE)?.value;
  const uid = await verifySession(cookie);
  if (uid) redirect("/");

  return (
    <div className="flex min-h-screen">

      {/* ─── LEFT: brand showcase (desktop only) ──────────────────── */}
      <div className="auth-canvas relative hidden flex-1 overflow-hidden lg:flex">
        {/* Slow-drifting pools of brand colour, in place of the two static
            gradients that used to sit here. Painted only, and stopped
            entirely under prefers-reduced-motion. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="auth-aurora auth-aurora-1" />
          <div className="auth-aurora auth-aurora-2" />
          <div className="auth-aurora auth-aurora-3" />
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            backgroundImage:
              "radial-gradient(circle, color-mix(in oklab, var(--color-accent) 22%, transparent) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* The same instruments that run down the sidebar rail — so signing in
            reads as the front door of the same building, not a separate page. */}
        <div aria-hidden className="chrome-motif pointer-events-none absolute inset-0 z-[2]" />

        <div className="absolute inset-0 z-[3] flex flex-col justify-between p-10 xl:p-14">
          <div className="rise">
            <MandovaraLogoLight />
            <div
              className="mt-5 inline-flex items-center gap-2 rounded-full px-3 py-[5px]"
              style={{
                background: "color-mix(in oklab, var(--color-accent) 14%, transparent)",
                border: "1px solid color-mix(in oklab, var(--color-accent) 30%, transparent)",
              }}
            >
              <span className="h-[6px] w-[6px] rounded-full bg-accent-chrome" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-chrome">
                Studio Console
              </span>
            </div>
          </div>

          <div className="rise" style={{ "--d": "90ms" } as React.CSSProperties}>
            <div className="mb-5 text-[10px] font-semibold uppercase tracking-[0.26em] text-accent-chrome">
              Measure &middot; Quote &middot; Install
            </div>
            <h1
              className="mb-6 font-display leading-[1.06] tracking-[-0.02em] text-sidebar-text"
              style={{ fontSize: "clamp(40px, 4.6vw, 58px)", fontWeight: 600 }}
            >
              Exquisite<br />Interior<br />Designers.
            </h1>
            <p className="max-w-[320px] text-[14px] leading-[1.7] text-sidebar-dim">
              Measure once on your phone — fabric quantities, roll counts
              and cut lists flow automatically from that single reading.
            </p>
          </div>

          <div className="rise" style={{ "--d": "180ms" } as React.CSSProperties}>
            <div className="on-chrome-rule mb-7 h-px" />
            <dl className="mb-8 flex flex-wrap gap-x-10 gap-y-6 xl:gap-x-14">
              {CLAIMS.map(({ Icon, figure, caption }) => (
                <div key={caption} className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
                    style={{
                      border: "1px solid color-mix(in oklab, var(--color-accent) 38%, transparent)",
                      background: "color-mix(in oklab, var(--color-accent) 10%, transparent)",
                    }}
                  >
                    <Icon size={17} strokeWidth={1.6} className="text-accent-chrome" />
                  </span>
                  <div>
                    <dt className="font-data text-[20px] leading-none tabular-nums text-sidebar-text">
                      {figure}
                    </dt>
                    <dd className="mt-1.5 text-[10.5px] tracking-[0.04em] text-sidebar-dim">
                      {caption}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
            <div className="flex items-start gap-2 text-[10.5px] leading-[1.6] tracking-[0.04em] text-sidebar-dim opacity-70">
              <MapPin size={12} strokeWidth={1.7} className="mt-[1px] shrink-0" />
              <span>32 Thirumoorthy Layout, RS Puram &middot; Coimbatore 641002</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── RIGHT: the form ──────────────────────────────────────────
             Desktop: a clean light panel beside the brand column.
             Mobile: this IS the viewport, so it carries the drifting
             canvas and the form sits on glass. */}
      <div className="auth-canvas relative flex min-h-screen w-full flex-col lg:w-[480px] lg:bg-none xl:w-[520px]">

        {/* Mobile-only ground. Hidden from lg up, where the panel is white
            and the brand column to its left carries the movement. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden lg:hidden">
          <div className="auth-aurora auth-aurora-1" />
          <div className="auth-aurora auth-aurora-2" />
          <div className="auth-aurora auth-aurora-3" />
        </div>
        <div aria-hidden className="chrome-motif pointer-events-none absolute inset-0 lg:hidden" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 lg:hidden"
          style={{
            backgroundImage:
              "radial-gradient(circle, color-mix(in oklab, var(--color-accent) 18%, transparent) 1px, transparent 1px)",
            backgroundSize: "30px 30px",
          }}
        />

        {/* Desktop ground: warm ivory rather than flat white, so the panel
            reads as paper beside the deep green column instead of as a hole
            cut out of it. #FCFAF6 against #3A5A58 body copy is 8.9:1 — the
            §6.2 floor is unaffected by the warmth. */}
        <div aria-hidden className="absolute inset-0 hidden bg-[#FCFAF6] lg:block" />
        <div aria-hidden className="absolute inset-y-0 left-0 hidden w-px bg-[#E0EEEC] lg:block" />

        <div
          className="relative z-10 flex flex-1 items-center justify-center px-4 py-10 sm:px-6 lg:px-10"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 40px)" }}
        >
          <div className="rise w-full max-w-[440px] lg:max-w-[400px]">
            {/* Glass on a phone, where it floats over moving colour. On
                desktop the panel behind it is already white, so the frost
                would be invisible and the ring merely noise. */}
            <div className="auth-glass auth-glass-flat-lg rounded-[20px] p-6 sm:p-8 lg:rounded-none lg:p-0">
              <Suspense>
                <LoginCard />
              </Suspense>
            </div>

            {/* Below lg the brand column is hidden, so the page would
                otherwise say nothing about who this is beyond a logo. The
                same three figures, compact, on the canvas under the card —
                and gone again the moment the full column is available. */}
            <div className="mt-7 lg:hidden">
              <div className="flex items-center justify-center gap-x-7 gap-y-4 sm:gap-x-10">
                {CLAIMS.map(({ Icon, figure, caption }) => (
                  <div key={caption} className="text-center">
                    <Icon
                      size={15}
                      strokeWidth={1.6}
                      aria-hidden
                      className="mx-auto mb-1.5 text-accent-chrome"
                    />
                    <div className="font-data text-[15px] leading-none tabular-nums text-sidebar-text">
                      {figure}
                    </div>
                    <div className="mt-1 text-[10px] tracking-[0.04em] text-sidebar-dim">
                      {caption}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 text-center text-[10px] tracking-[0.04em] text-sidebar-dim opacity-70">
                32 Thirumoorthy Layout, RS Puram &middot; Coimbatore 641002
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
