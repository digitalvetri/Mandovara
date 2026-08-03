"use client";

// Three sign-in methods on one login form:
//   • Mobile + OTP   — primary path, matches CLAUDE.md "mobile-first"
//   • Email + password — desk staff on a keyboard (accounts, sales)
//   • Kiosk PIN     — shared devices (storekeeper godown, site tablet)
//
// UI is a mock until Session 7 lands the real Argon2id / httpOnly-cookie /
// rotation-on-privilege-change auth stack — any submit currently drops
// the user on the dashboard.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Smartphone, Mail, KeyRound } from "lucide-react";

type Method = "mobile" | "email" | "pin";

export function LoginTabs() {
  const router = useRouter();
  const [method, setMethod] = useState<Method>("mobile");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function fakeSubmit() {
    setError(null);
    startTransition(() => {
      setTimeout(() => router.push("/" as Route), 300);
    });
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-1 p-1 bg-sidebar-hover rounded-[10px] mb-6">
        <Tab icon={<Smartphone size={13} />} label="Mobile · OTP"  active={method === "mobile"} onClick={() => setMethod("mobile")} />
        <Tab icon={<Mail       size={13} />} label="Email"         active={method === "email"}  onClick={() => setMethod("email")} />
        <Tab icon={<KeyRound   size={13} />} label="Kiosk PIN"     active={method === "pin"}    onClick={() => setMethod("pin")} />
      </div>

      {method === "mobile" && <MobileForm pending={pending} onSubmit={fakeSubmit} />}
      {method === "email"  && <EmailForm  pending={pending} onSubmit={fakeSubmit} />}
      {method === "pin"    && <PinForm    pending={pending} onSubmit={fakeSubmit} />}

      {error && <div className="mt-3 text-[12px] text-bad">{error}</div>}

      <p className="mt-6 text-[10.5px] text-sidebar-dim leading-relaxed text-center">
        Real auth (Argon2id · httpOnly cookies · rotation on privilege change)
        lands in Session 7.
      </p>
    </div>
  );
}

function Tab({ icon, label, active, onClick }: {
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
            className={[
              "inline-flex items-center justify-center gap-1.5 h-[34px] rounded-[8px] text-[11.5px] transition-colors",
              active ? "bg-accent text-white" : "text-sidebar-dim hover:text-sidebar-text",
            ].join(" ")}>
      {icon} {label}
    </button>
  );
}

// ── Mobile + OTP ────────────────────────────────────────────────

function MobileForm({ pending, onSubmit }: { pending: boolean; onSubmit: () => void }) {
  const [step, setStep] = useState<"mobile" | "otp">("mobile");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);

  function setOtpAt(i: number, v: string) {
    if (v.length > 1) v = v.slice(-1);
    if (!/^\d?$/.test(v)) return;
    setOtp((o) => o.map((x, idx) => (idx === i ? v : x)));
    if (v && i < 5) {
      const next = document.querySelector<HTMLInputElement>(`input[data-otp="${i + 1}"]`);
      next?.focus();
    }
  }

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      if (step === "mobile") setStep("otp");
      else onSubmit();
    }} className="space-y-4">
      <Field label="Mobile number">
        <div className="flex items-center gap-2 h-[46px] px-3 bg-sidebar-hover rounded-[10px]">
          <span className="text-sidebar-dim text-[13px] tabular">+91</span>
          <input
            value={mobile}
            onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
            disabled={step === "otp"}
            inputMode="tel" placeholder="98765 43210"
            className="flex-1 bg-transparent text-sidebar-text text-[14px] tabular outline-none placeholder:text-sidebar-dim disabled:opacity-60"
          />
          {step === "otp" && (
            <button type="button"
                    onClick={() => { setStep("mobile"); setOtp(["", "", "", "", "", ""]); }}
                    className="text-[10.5px] text-accent hover:underline">
              Change
            </button>
          )}
        </div>
      </Field>

      {step === "otp" && (
        <Field label="6-digit OTP · sent via WhatsApp">
          <div className="grid grid-cols-6 gap-2">
            {otp.map((d, i) => (
              <input
                key={i} data-otp={i} value={d}
                onChange={(e) => setOtpAt(i, e.target.value)}
                inputMode="numeric" maxLength={1}
                className="h-[52px] bg-sidebar-hover rounded-[10px] text-sidebar-text text-[20px] font-medium tabular text-center outline-none focus:ring-1 focus:ring-accent"
              />
            ))}
          </div>
        </Field>
      )}

      <SubmitButton pending={pending} label={step === "mobile" ? "Send OTP on WhatsApp" : "Sign in"} />
    </form>
  );
}

// ── Email + password ─────────────────────────────────────────────

function EmailForm({ pending, onSubmit }: { pending: boolean; onSubmit: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-4">
      <Field label="Email">
        <input value={email} onChange={(e) => setEmail(e.target.value)}
               type="email" placeholder="you@mandovara.example"
               className={fieldCls} />
      </Field>
      <Field label="Password">
        <input value={password} onChange={(e) => setPassword(e.target.value)}
               type="password" placeholder="••••••••"
               className={fieldCls} />
      </Field>
      <div className="text-right">
        <button type="button" className="text-[11.5px] text-sidebar-dim hover:text-accent">
          Forgot password?
        </button>
      </div>
      <SubmitButton pending={pending} label="Sign in" />
    </form>
  );
}

// ── Kiosk PIN (shared devices) ──────────────────────────────────

function PinForm({ pending, onSubmit }: { pending: boolean; onSubmit: () => void }) {
  const [pin, setPin] = useState<string[]>(["", "", "", ""]);
  function set(i: number, v: string) {
    if (v.length > 1) v = v.slice(-1);
    if (!/^\d?$/.test(v)) return;
    setPin((p) => p.map((x, idx) => (idx === i ? v : x)));
    if (v && i < 3) {
      const next = document.querySelector<HTMLInputElement>(`input[data-pin="${i + 1}"]`);
      next?.focus();
    }
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-4">
      <Field label="4-digit PIN · shared / kiosk device">
        <div className="grid grid-cols-4 gap-2">
          {pin.map((d, i) => (
            <input key={i} data-pin={i} value={d}
                   onChange={(e) => set(i, e.target.value)}
                   inputMode="numeric" maxLength={1}
                   className="h-[52px] bg-sidebar-hover rounded-[10px] text-sidebar-text text-[22px] font-medium tabular text-center outline-none focus:ring-1 focus:ring-accent" />
          ))}
        </div>
      </Field>
      <p className="text-[11px] text-sidebar-dim">
        Storekeeper &amp; field staff sign in with a device-bound PIN.
        Session is short-lived.
      </p>
      <SubmitButton pending={pending} label="Unlock" />
    </form>
  );
}

// ── primitives ──────────────────────────────────────────────────

const fieldCls =
  "w-full h-[46px] px-3 bg-sidebar-hover rounded-[10px] text-sidebar-text text-[13px] outline-none placeholder:text-sidebar-dim";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[10.5px] uppercase tracking-[0.14em] text-sidebar-dim">{label}</div>
      {children}
    </label>
  );
}
function SubmitButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button type="submit" disabled={pending}
            className="w-full h-[46px] rounded-[10px] bg-accent text-white text-[13px] font-medium hover:bg-accent-hover disabled:opacity-60 transition-colors">
      {pending ? "Signing in…" : label}
    </button>
  );
}
