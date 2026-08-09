import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ThreeCanvas } from "./_components/ThreeCanvas";
import { LoginCard } from "./_components/LoginTabs";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const jar = await cookies();
  if (jar.has("dev_uid")) redirect("/");

  return (
    <div className="min-h-screen flex">

      {/* ─── LEFT: Brand showcase ──────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-1 relative overflow-hidden"
        style={{ background: "#0B1918" }}
      >
        {/* Three.js teal particle field — fills the left panel */}
        <ThreeCanvas />

        {/* Dot-grid texture overlay */}
        <div
          aria-hidden
          className="absolute inset-0 z-[1] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(43,168,154,0.065) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />

        {/* Bottom-center radial glow */}
        <div
          aria-hidden
          className="absolute inset-0 z-[2] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 45% 80%, rgba(43,168,154,0.08) 0%, transparent 70%)",
          }}
        />

        {/* Content */}
        <div className="absolute inset-0 z-[3] flex flex-col justify-between p-10 xl:p-14">

          {/* Top: logo + badge */}
          <div>
            <WhiteLogo />
            <div
              className="mt-4 inline-flex items-center gap-2 px-3 py-[5px] rounded-full"
              style={{
                background: "rgba(43,168,154,0.11)",
                border: "1px solid rgba(43,168,154,0.24)",
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

          {/* Centre: headline */}
          <div>
            <div
              className="text-[10.5px] font-semibold tracking-[0.24em] uppercase mb-4"
              style={{ color: "#3DB8AA" }}
            >
              Measure · Quote · Install
            </div>
            <h1
              className="font-display leading-[1.04] tracking-[-0.02em] text-white mb-5"
              style={{ fontSize: "clamp(44px, 5vw, 62px)", fontWeight: 600 }}
            >
              Exquisite<br />Interior<br />Designers.
            </h1>
            <p className="text-[14.5px] max-w-[340px] leading-[1.65]" style={{ color: "#6BB5AF" }}>
              Measure once on your phone — fabric quantities, roll counts and cut lists flow automatically from that single reading.
            </p>

            {/* Product family chips */}
            <div className="flex flex-wrap gap-2 mt-7">
              {["Curtains", "Wallpaper", "Flooring", "Blinds", "Carpets", "Upholstery", "Films"].map(f => (
                <span
                  key={f}
                  className="px-3 py-1 rounded-full text-[11px] font-medium"
                  style={{
                    background: "rgba(43,168,154,0.09)",
                    border: "1px solid rgba(43,168,154,0.2)",
                    color: "#6BB5AF",
                  }}
                >
                  {f}
                </span>
              ))}
            </div>
          </div>

          {/* Bottom: stats */}
          <div>
            <div className="h-px mb-6" style={{ background: "rgba(255,255,255,0.08)" }} />
            <div className="flex gap-7 xl:gap-10">
              {[
                { n: "10+",    label: "Years" },
                { n: "1,200", label: "Projects" },
                { n: "22",    label: "Brands" },
                { n: "85",    label: "Awards" },
              ].map(({ n, label }) => (
                <div key={label}>
                  <div
                    className="text-[26px] font-semibold text-white leading-none"
                    style={{ fontFamily: "'Geist Mono', 'SF Mono', monospace" }}
                  >
                    {n}
                  </div>
                  <div
                    className="text-[10px] font-semibold tracking-[0.14em] uppercase mt-1.5"
                    style={{ color: "#3DB8AA" }}
                  >
                    {label}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 text-[10.5px] tracking-[0.04em]" style={{ color: "#2E6B64" }}>
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
          <MobileLogo />
        </div>

        {/* Form — centred vertically */}
        <div className="flex-1 flex items-center justify-center px-8 xl:px-12 py-10">
          <LoginCard />
        </div>
      </div>
    </div>
  );
}

// ── Left-panel white logo ─────────────────────────────────────────────────────

function WhiteLogo() {
  return (
    <div className="flex items-center gap-3">
      {/* Leaf icon — teal on dark background */}
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <path d="M20 36 C 14 26 8 18 11 6 C 17 8 21 20 20 36 Z"  fill="#4CC5B8" opacity="0.55" />
        <path d="M20 36 C 17 24 13 16 16 7 C 20 9 21 22 20 36 Z"  fill="#4CC5B8" opacity="0.82" />
        <path d="M20 36 C 20 24 19 15 20 4 C 21 15 20 24 20 36 Z"  fill="#4CC5B8" />
        <path d="M20 36 C 23 24 27 16 24 7 C 20 9 19 22 20 36 Z"  fill="#4CC5B8" opacity="0.82" />
        <path d="M20 36 C 26 26 32 18 29 6 C 23 8 19 20 20 36 Z"  fill="#4CC5B8" opacity="0.55" />
      </svg>
      <div>
        <div style={{
          color: "#FFFFFF",
          fontFamily: "'Fraunces', Georgia, serif",
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: "0.03em",
          lineHeight: 1,
        }}>
          Mandovara
        </div>
        <div style={{
          color: "rgba(255,255,255,0.42)",
          fontSize: 9,
          letterSpacing: "0.26em",
          marginTop: 5,
          fontWeight: 600,
          textTransform: "uppercase",
        }}>
          Interiors
        </div>
      </div>
    </div>
  );
}

// ── Mobile-only compact logo ──────────────────────────────────────────────────

function MobileLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
        <path d="M20 36 C 14 26 8 18 11 6 C 17 8 21 20 20 36 Z"  fill="#2BA89A" opacity="0.55" />
        <path d="M20 36 C 17 24 13 16 16 7 C 20 9 21 22 20 36 Z"  fill="#2BA89A" opacity="0.82" />
        <path d="M20 36 C 20 24 19 15 20 4 C 21 15 20 24 20 36 Z"  fill="#2BA89A" />
        <path d="M20 36 C 23 24 27 16 24 7 C 20 9 19 22 20 36 Z"  fill="#2BA89A" opacity="0.82" />
        <path d="M20 36 C 26 26 32 18 29 6 C 23 8 19 20 20 36 Z"  fill="#2BA89A" opacity="0.55" />
      </svg>
      <div style={{
        color: "#1A4A45",
        fontFamily: "'Fraunces', Georgia, serif",
        fontSize: 20,
        fontWeight: 600,
        letterSpacing: "0.03em",
      }}>
        Mandovara
      </div>
    </div>
  );
}
