"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { devLoginByCredential } from "@/lib/dev-auth";
import { Loader2, Eye, EyeOff, ArrowRight, Info } from "lucide-react";
import { MandovaraLogo } from "./MandovaraLogo";
import { CredentialsPanel, DEFAULT_PASSWORD } from "./CredentialsPanel";

function focusStyle(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = "#2BA89A";
  e.currentTarget.style.background  = "#ffffff";
  e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(43,168,154,0.12)";
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

  // Show the seeded-credentials helper only in dev builds. In production
  // this component simply renders nothing when SHOW_CREDS is false.
  const SHOW_CREDS_HELPER = process.env.NODE_ENV !== "production";

  function navigate() {
    const dest = params.get("from") ?? "/";
    router.push(dest);
    router.refresh();
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!credential.trim() || !password) return;
    setError(null);
    start(async () => {
      const res = await devLoginByCredential(credential.trim(), password);
      if (!res.ok) { setError(res.error ?? "Login failed"); return; }
      navigate();
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
    <div className="w-full max-w-[420px] mx-auto">

      {/* Logo */}
      <div className="mb-8">
        <MandovaraLogo />
      </div>

      {/* Heading */}
      <div className="mb-7">
        <h1
          className="text-[28px] font-semibold leading-tight tracking-[-0.02em]"
          style={{ color: "#0F2A28", fontFamily: "'Fraunces', Georgia, serif" }}
        >
          Welcome back
        </h1>
        <p className="mt-2 text-[13.5px]" style={{ color: "#5A7A78" }}>
          Sign in to your studio console
        </p>
      </div>

      {/* ── Email / mobile + password form ─── */}
      <form onSubmit={handleEmailLogin} className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="login-credential"
              className="text-[11.5px] font-semibold tracking-[0.04em] uppercase"
              style={{ color: "#4A6462" }}
            >
              Email or Mobile
            </label>
            {SHOW_CREDS_HELPER && (
              <button
                type="button"
                onClick={() => setShowCreds((v) => !v)}
                className="flex items-center gap-1 text-[10.5px] font-medium transition-colors"
                style={{ color: "#2BA89A" }}
              >
                <Info size={11} strokeWidth={2} />
                View credentials
              </button>
            )}
          </div>

          {/* Credentials helper panel — dev only */}
          {SHOW_CREDS_HELPER && showCreds && (
            <CredentialsPanel onSelect={fillCredential} />
          )}

          <input
            id="login-credential"
            type="text"
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            placeholder="rohit@mandovara.com · +91 98xxxxxxxx"
            autoComplete="username"
            autoFocus
            className="w-full h-[48px] rounded-[12px] px-4 text-[13.5px] outline-none transition-all"
            style={{ background: "#F0F8F7", border: "1.5px solid #C8DFD8", color: "#0F2A28" }}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />
        </div>

        <div>
          <label
            htmlFor="login-password"
            className="block text-[11.5px] font-semibold mb-1.5 tracking-[0.04em] uppercase"
            style={{ color: "#4A6462" }}
          >
            Password
          </label>
          <div className="relative">
            <input
              id="login-password"
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full h-[48px] rounded-[12px] px-4 pr-12 text-[13.5px] outline-none transition-all"
              style={{ background: "#F0F8F7", border: "1.5px solid #C8DFD8", color: "#0F2A28" }}
              onFocus={focusStyle}
              onBlur={blurStyle}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPwd((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
              style={{ color: "#7A9A98" }}
              aria-label={showPwd ? "Hide password" : "Show password"}
            >
              {showPwd ? <EyeOff size={16} strokeWidth={1.8} /> : <Eye size={16} strokeWidth={1.8} />}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            className="px-4 py-3 rounded-[10px] text-[12.5px] leading-snug"
            style={{ background: "#FFF0EE", border: "1px solid #FFCBC4", color: "#B83A2E" }}
          >
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={pending || !canSubmit}
          className="w-full h-[50px] rounded-[12px] flex items-center justify-center gap-2 text-[14px] font-semibold text-white transition-all duration-200 active:scale-[0.99] mt-1"
          style={{
            background: pending || !canSubmit
              ? "#A8D5CF"
              : "linear-gradient(135deg, #2BA89A 0%, #1A8A7E 100%)",
            boxShadow:  pending || !canSubmit ? "none" : "0 4px 22px rgba(43,168,154,0.38)",
            cursor:     pending || !canSubmit ? "not-allowed" : "pointer",
          }}
        >
          {pending
            ? <Loader2 size={18} className="animate-spin" />
            : <><span>Sign In</span><ArrowRight size={16} strokeWidth={2.2} /></>}
        </button>
      </form>

      {/* Footer */}
      <div
        className="mt-8 pt-5 text-center text-[10.5px]"
        style={{ borderTop: "1px solid #E2F0EE", color: "#8AACAA" }}
      >
        Mandovara Business Solutions · RS Puram, Coimbatore
      </div>
    </div>
  );
}
