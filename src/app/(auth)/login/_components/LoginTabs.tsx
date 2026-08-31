"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { devLoginByCredential } from "@/lib/dev-auth";
import { Loader2, Eye, EyeOff, ArrowRight, Info, ShieldCheck } from "lucide-react";
import { MandovaraLogo } from "./MandovaraLogo";
import { CredentialsPanel, DEFAULT_PASSWORD } from "./CredentialsPanel";

// Input focus/blur handlers — a subtle brand-teal ring on focus.
function focusStyle(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = "#2BA89A";
  e.currentTarget.style.background  = "#ffffff";
  e.currentTarget.style.boxShadow   = "0 0 0 4px rgba(43,168,154,0.14)";
}
function blurStyle(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = "#C8DFD8";
  e.currentTarget.style.background  = "#F0F8F7";
  e.currentTarget.style.boxShadow   = "none";
}

export function LoginCard() {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start]            = useTransition();
  const [error, setError]           = useState<string | null>(null);
  const [credential, setCredential] = useState("");
  const [password, setPassword]     = useState("");
  const [showPwd, setShowPwd]       = useState(false);
  const [showCreds, setShowCreds]   = useState(false);
  const credRef = useRef<HTMLInputElement>(null);
  const pwdRef  = useRef<HTMLInputElement>(null);

  const SHOW_CREDS_HELPER = process.env.NODE_ENV !== "production";

  function navigate(dest: string) {
    router.push(dest);
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Read DOM values so browser autofill is captured even if onChange didn't fire.
    const cred = (credRef.current?.value ?? credential).trim();
    const pwd  = pwdRef.current?.value ?? password;
    if (!cred || !pwd) return;
    setError(null);
    start(async () => {
      const res = await devLoginByCredential(cred, pwd);
      if (!res.ok) { setError(res.error ?? "Login failed"); return; }
      if (res.mustChangePassword) { navigate("/change-password?forced=1"); return; }
      const from = params.get("from");
      const authPaths = ["/login", "/forgot-password", "/reset-password", "/change-password"];
      const safe = from && !authPaths.some(p => from.startsWith(p)) ? from : null;
      navigate(safe ?? (res.role === "OWNER" ? "/" : "/employee"));
    });
  }

  function fillCredential(email: string) {
    setCredential(email);
    setPassword(DEFAULT_PASSWORD);
    setShowCreds(false);
    setError(null);
  }

  const canSubmit = credential.trim().length > 0 && password.length > 0;

  return (
    // No card chrome of its own any more: the frosted panel in page.tsx is
    // the card. Leaving the old white background here put a solid card
    // inside a glass one, which reads as a bug rather than as depth.
    <div className="w-full">

      {/* Logo */}
      <div className="rise mb-6 sm:mb-7">
        <MandovaraLogo studio />
      </div>

      {/* Heading — each block enters just behind the one above it, so the
          card assembles rather than appearing all at once. */}
      <div className="rise mb-6 sm:mb-7" style={{ "--d": "70ms" } as React.CSSProperties}>
        <h1
          style={{
            color: "#0F2A28",
            fontFamily: "'Fraunces', Georgia, serif",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            margin: 0,
            fontSize: "clamp(22px, 6vw, 32px)",
          }}
        >
          Welcome back
        </h1>
        <p
          className="mt-2.5 leading-snug"
          style={{ color: "#375653", fontSize: "clamp(12.5px, 3.4vw, 14.5px)" }}
        >
          Sign in to your Mandovara Studio Console
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rise space-y-4 sm:space-y-5"
        style={{ "--d": "140ms" } as React.CSSProperties}
      >

        {/* Email / Mobile */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="cred"
              className="text-[10px] sm:text-[11px] font-semibold tracking-[0.08em] uppercase"
              style={{ color: "#2F4E4C" }}
            >
              Email, mobile or code
            </label>
            {SHOW_CREDS_HELPER && (
              <button
                type="button"
                onClick={() => setShowCreds((v) => !v)}
                className="flex items-center gap-1 text-[10.5px] font-medium transition-opacity hover:opacity-70"
                style={{ color: "#14564C" }}
                suppressHydrationWarning
              >
                <Info size={10} strokeWidth={2.2} />
                View credentials
              </button>
            )}
          </div>

          {SHOW_CREDS_HELPER && showCreds && (
            <div className="mb-2">
              <CredentialsPanel onSelect={fillCredential} />
            </div>
          )}

          <input
            id="cred"
            ref={credRef}
            type="text"
            inputMode="email"
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            placeholder="mandovara22@gmail.com · +91 98xxxxxxxx · EMP-001"
            autoComplete="username"
            className="w-full outline-none transition-all"
            suppressHydrationWarning
            style={{
              height: 54,
              borderRadius: 14,
              padding: "0 18px",
              fontSize: 15,
              background: "#F0F8F7",
              border: "1.5px solid #C8DFD8",
              color: "#0F2A28",
            }}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="pwd"
              className="text-[10px] sm:text-[11px] font-semibold tracking-[0.08em] uppercase"
              style={{ color: "#2F4E4C" }}
            >
              Password
            </label>
            <a
              href="/forgot-password"
              className="text-[11.5px] font-medium transition-opacity hover:opacity-70"
              style={{ color: "#14564C" }}
              suppressHydrationWarning
            >
              Forgot password?
            </a>
          </div>
          <div className="relative">
            <input
              id="pwd"
              ref={pwdRef}
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              className="w-full outline-none transition-all"
              suppressHydrationWarning
              style={{
                height: 54,
                borderRadius: 14,
                padding: "0 52px 0 18px",
                fontSize: 15,
                background: "#F0F8F7",
                border: "1.5px solid #C8DFD8",
                color: "#0F2A28",
              }}
              onFocus={focusStyle}
              onBlur={blurStyle}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPwd((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 grid place-items-center rounded-[10px] transition-opacity hover:opacity-70"
              style={{ color: "#5F7F7D" }}
              aria-label={showPwd ? "Hide password" : "Show password"}
            >
              {showPwd
                ? <EyeOff size={17} strokeWidth={1.8} />
                : <Eye    size={17} strokeWidth={1.8} />}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="px-4 py-3 rounded-[12px] text-[13px] leading-snug"
            style={{ background: "#FFF0EE", border: "1px solid #FFCBC4", color: "#B83A2E" }}
          >
            {error}
          </div>
        )}

        {/* Sign In — 56px, generous touch target.
            The disabled fill used to be a pale mint (#A8D5CF) that read as a
            broken primary button on arrival, since an empty form is the state
            everybody sees first. It is now plainly a disabled control: muted
            surface, muted label, no glow. The enabled state keeps the accent
            gradient and its lift, and the arrow steps forward on hover. */}
        <button
          type="submit"
          disabled={pending}
          className={[
            "group/cta w-full h-[56px] mt-1.5 rounded-[14px]",
            "flex items-center justify-center gap-2.5 font-semibold text-[14px] sm:text-[15.5px]",
            "transition-all duration-200 press",
            pending
              ? "bg-surface-hover text-text-subtle border border-rule cursor-not-allowed"
              : canSubmit
                ? "bg-accent text-white border border-transparent hover:bg-accent-hover shadow-md hover:shadow-lg"
                : "bg-surface-hover text-text-subtle border border-rule",
          ].join(" ")}
        >
          {pending
            ? <Loader2 size={18} className="animate-spin" />
            : (
              <>
                <span>Sign In</span>
                <ArrowRight
                  size={17}
                  strokeWidth={2.2}
                  className="transition-transform duration-200 group-hover/cta:translate-x-[3px]"
                />
              </>
            )}
        </button>
      </form>

      {/* Footer. The padlock is not decoration: sessions are a signed HMAC
          cookie over TLS, and a studio owner typing a password into a
          browser they were sent a link to is entitled to see it said. */}
      <div
        className="mt-7 pt-4 sm:mt-8 sm:pt-5 lg:mt-10"
        style={{ borderTop: "1px solid #E2F0EE" }}
      >
        <div
          className="flex items-center justify-center gap-1.5 text-[11px] font-medium"
          style={{ color: "#2F4E4C" }}
        >
          <ShieldCheck size={13} strokeWidth={1.9} />
          Secure sign-in
        </div>
        <div className="mt-2 text-center text-[10.5px]" style={{ color: "#375653" }}>
          Mandovara Business Solutions · RS Puram, Coimbatore
        </div>
      </div>
    </div>
  );
}
