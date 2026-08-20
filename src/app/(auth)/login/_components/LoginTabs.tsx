"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { devLoginByCredential } from "@/lib/dev-auth";
import { Loader2, Eye, EyeOff, ArrowRight, Info } from "lucide-react";
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

  const SHOW_CREDS_HELPER = process.env.NODE_ENV !== "production";

  function navigate(dest: string) {
    router.push(dest);
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!credential.trim() || !password) return;
    setError(null);
    start(async () => {
      const res = await devLoginByCredential(credential.trim(), password);
      if (!res.ok) { setError(res.error ?? "Login failed"); return; }
      if (res.mustChangePassword) { navigate("/change-password?forced=1"); return; }
      navigate(params.get("from") ?? (res.role === "OWNER" ? "/" : "/employee"));
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
    // Mobile: the whole thing sits inside a soft white card that floats on
    // the brand wash. Desktop keeps it flush to the right panel (no card
    // ring, no shadow — the panel itself is the container there).
    <div className="rise w-full max-w-[420px] mx-auto lg:max-w-[400px] lg:bg-transparent lg:shadow-none lg:border-0 lg:p-0 lg:rounded-none bg-white rounded-[20px] p-6 sm:p-8 shadow-[0_20px_60px_-20px_rgba(43,168,154,0.20),0_2px_8px_rgba(15,42,40,0.06)] border border-[#E7F1EF]">

      {/* Logo — bigger and more generous on mobile */}
      <div className="mb-8 lg:mb-10">
        <MandovaraLogo />
      </div>

      {/* Heading */}
      <div className="mb-7 lg:mb-8">
        <h1
          style={{
            color: "#0F2A28",
            fontFamily: "'Fraunces', Georgia, serif",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            margin: 0,
            fontSize: "clamp(26px, 7vw, 32px)",
          }}
        >
          Welcome back
        </h1>
        <p
          className="mt-2.5 leading-snug"
          style={{ color: "#5A7A78", fontSize: "clamp(13.5px, 3.6vw, 14.5px)" }}
        >
          Sign in to your Mandovara Studio Console
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Email / Mobile */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="cred"
              className="text-[11px] font-semibold tracking-[0.08em] uppercase"
              style={{ color: "#3A5A58" }}
            >
              Email or Mobile Number
            </label>
            {SHOW_CREDS_HELPER && (
              <button
                type="button"
                onClick={() => setShowCreds((v) => !v)}
                className="flex items-center gap-1 text-[10.5px] font-medium transition-opacity hover:opacity-70"
                style={{ color: "#2BA89A" }}
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
            type="text"
            inputMode="email"
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            placeholder="rohit@mandovara.com  or  +91 98xxxxxxxx"
            autoComplete="username"
            className="w-full outline-none transition-all"
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
              className="text-[11px] font-semibold tracking-[0.08em] uppercase"
              style={{ color: "#3A5A58" }}
            >
              Password
            </label>
            <a
              href="/forgot-password"
              className="text-[11.5px] font-medium transition-opacity hover:opacity-70"
              style={{ color: "#2BA89A" }}
            >
              Forgot password?
            </a>
          </div>
          <div className="relative">
            <input
              id="pwd"
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              className="w-full outline-none transition-all"
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
              style={{ color: "#7A9A98" }}
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
          disabled={pending || !canSubmit}
          className={[
            "group/cta w-full h-[56px] mt-1.5 rounded-[14px]",
            "flex items-center justify-center gap-2.5 font-semibold text-[15.5px]",
            "transition-all duration-200 press",
            pending || !canSubmit
              ? "bg-surface-hover text-text-subtle border border-rule cursor-not-allowed"
              : "bg-accent text-white border border-transparent hover:bg-accent-hover shadow-md hover:shadow-lg",
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

      {/* Footer */}
      <div
        className="mt-8 lg:mt-10 pt-5 text-center text-[10.5px]"
        style={{ borderTop: "1px solid #E2F0EE", color: "#8AACAA" }}
      >
        Mandovara Business Solutions · RS Puram, Coimbatore
      </div>
    </div>
  );
}
