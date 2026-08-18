import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginCard } from "./_components/LoginTabs";
import { MandovaraLogo, MandovaraLogoLight } from "./_components/MandovaraLogo";
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
      <div
        className="hidden lg:flex flex-1 relative overflow-hidden"
        style={{ background: "#0B1918" }}
      >
        {/* Static brand panel. The three.js scene that used to live here was
            removed: three is not in §2's stack, it shipped ~600KB to a login
            page, and it is decoration rather than function. */}

        {/* Dot-grid texture overlay */}
        <div
          aria-hidden
          className="absolute inset-0 z-[1] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(43,168,154,0.05) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Subtle radial glow — bottom */}
        <div
          aria-hidden
          className="absolute inset-0 z-[2] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 45% 85%, rgba(43,168,154,0.07) 0%, transparent 70%)",
          }}
        />

        {/* Content */}
        <div className="absolute inset-0 z-[3] flex flex-col justify-between p-10 xl:p-14">

          {/* Top: logo + badge */}
          <div>
            <MandovaraLogoLight />
            <div
              className="mt-5 inline-flex items-center gap-2 px-3 py-[5px] rounded-full"
              style={{
                background: "rgba(43,168,154,0.10)",
                border: "1px solid rgba(43,168,154,0.22)",
              }}
            >
              <span className="w-[6px] h-[6px] rounded-full" style={{ background: "#2BA89A" }} />
              <span
                className="text-[10px] font-semibold tracking-[0.18em] uppercase"
                style={{ color: "#4CC5B8" }}
              >
                Studio Console
              </span>
            </div>
          </div>

          {/* Centre: headline + tagline */}
          <div>
            <div
              className="text-[10px] font-semibold tracking-[0.26em] uppercase mb-5"
              style={{ color: "#3DB8AA" }}
            >
              Measure · Quote · Install
            </div>
            <h1
              className="font-display leading-[1.06] tracking-[-0.02em] text-white mb-6"
              style={{ fontSize: "clamp(40px, 4.6vw, 58px)", fontWeight: 600 }}
            >
              Exquisite<br />Interior<br />Designers.
            </h1>
            <p
              className="text-[14px] max-w-[320px] leading-[1.7]"
              style={{ color: "#6BB5AF" }}
            >
              Measure once on your phone — fabric quantities, roll counts
              and cut lists flow automatically from that single reading.
            </p>
          </div>

          {/* Bottom: address only */}
          <div>
            <div className="h-px mb-5" style={{ background: "rgba(255,255,255,0.06)" }} />
            <div className="text-[10.5px] tracking-[0.04em]" style={{ color: "#2E6B64" }}>
              32 Thirumoorthy Layout, RS Puram · Coimbatore 641002
            </div>
          </div>
        </div>
      </div>

      {/* ─── RIGHT: Login form ─────────────────────────────────────── */}
      <div
        className="w-full lg:w-[480px] xl:w-[520px] min-h-screen flex flex-col"
        style={{ background: "#FFFFFF", borderLeft: "1px solid #E0EEEC" }}
      >
        {/* Mobile logo — only shown when the left panel is hidden */}
        <div className="lg:hidden px-8 pt-10 pb-2">
          <MandovaraLogo />
        </div>

        {/* Form — centred vertically */}
        <div className="flex-1 flex items-center justify-center px-8 xl:px-12 py-10">
          <Suspense>
            <LoginCard />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

