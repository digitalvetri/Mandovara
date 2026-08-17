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
      if (res.mustChangePassword) {
        navigate("/change-password?forced=1");
        return;
      }
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
    <div className="w-full max-w-[400px] mx-auto">

      {/* Logo */}
      <div className="mb-10">
        <MandovaraLogo />
      </div>

      {/* Heading */}
      <div className="mb-8">
        <h1
          style={{
            color: "#0F2A28",
            fontFamily: "'Fraunces', Georgia, serif",
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
            margin: 0,
          }}
        >
          Welcome back
        </h1>
        <p className="mt-2.5 text-[14px] leading-snug" style={{ color: "#5A7A78" }}>
          Sign in to your Mandovara Studio Console
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Email / Mobile field */}
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
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            placeholder="rohit@mandovara.com  or  +91 98xxxxxxxx"
            autoComplete="username"
            className="w-full outline-none transition-all"
            style={{
              height: 50,
              borderRadius: 12,
              padding: "0 16px",
              fontSize: 13.5,
              background: "#F0F8F7",
              border: "1.5px solid #C8DFD8",
              color: "#0F2A28",
            }}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />
        </div>

        {/* Password field */}
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
              className="text-[11px] font-medium transition-opacity hover:opacity-70"
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
                height: 50,
                borderRadius: 12,
                padding: "0 48px 0 16px",
                fontSize: 13.5,
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
              className="absolute right-4 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
              style={{ color: "#7A9A98" }}
              aria-label={showPwd ? "Hide password" : "Show password"}
            >
              {showPwd
                ? <EyeOff size={16} strokeWidth={1.8} />
                : <Eye    size={16} strokeWidth={1.8} />}
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

        {/* Sign In button */}
        <button
          type="submit"
          disabled={pending || !canSubmit}
          className="w-full flex items-center justify-center gap-2.5 font-semibold text-white transition-all duration-200 active:scale-[0.99]"
          style={{
            height: 52,
            borderRadius: 12,
            fontSize: 14.5,
            marginTop: 4,
            background: pending || !canSubmit
              ? "#A8D5CF"
              : "linear-gradient(135deg, #2BA89A 0%, #1A8A7E 100%)",
            boxShadow: pending || !canSubmit ? "none" : "0 6px 24px rgba(43,168,154,0.35)",
            cursor:    pending || !canSubmit ? "not-allowed" : "pointer",
          }}
        >
          {pending
            ? <Loader2 size={18} className="animate-spin" />
            : <><span>Sign In</span><ArrowRight size={16} strokeWidth={2.2} /></>}
        </button>
      </form>

      {/* Footer */}
      <div
        className="mt-10 pt-5 text-center text-[10.5px]"
        style={{ borderTop: "1px solid #E2F0EE", color: "#8AACAA" }}
      >
        Mandovara Business Solutions · RS Puram, Coimbatore
      </div>
    </div>
  );
}
