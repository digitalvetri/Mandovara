"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginByMobilePin } from "@/lib/dev-auth";
import { Delete, Loader2 } from "lucide-react";

// ── PIN credential reference ─────────────────────────────────────────────────

const PIN_ACCOUNTS = [
  { role: "Owner",            name: "Rohit Sharma",    mobile: "+91 89404 30051", pin: "1234" },
  { role: "Designer",         name: "Priya Meenakshi", mobile: "+91 98421 10001", pin: "2001" },
  { role: "Sales",            name: "Arjun Kumar",     mobile: "+91 98421 10002", pin: "2002" },
  { role: "Measurement Exec", name: "Karthik Rajan",   mobile: "+91 98421 10003", pin: "2003" },
  { role: "Store Keeper",     name: "Selvi Lakshmi",   mobile: "+91 98421 10004", pin: "2004" },
  { role: "Make Supervisor",  name: "Murugan M",       mobile: "+91 98421 10005", pin: "2005" },
  { role: "Installer",        name: "Dinesh P",        mobile: "+91 98421 10006", pin: "2006" },
  { role: "Accounts",         name: "Kavitha R",       mobile: "+91 98421 10007", pin: "2007" },
  { role: "HR",               name: "Anand S",         mobile: "+91 98421 10008", pin: "2008" },
] as const;

const KEYPAD = ["1","2","3","4","5","6","7","8","9","⌫","0",""] as const;

// ── focus style helpers ──────────────────────────────────────────────────────

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

// ── component ────────────────────────────────────────────────────────────────

export function PinLoginPanel() {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [mobile, setMobile] = useState("");
  const [pin, setPin]       = useState("");
  const [error, setError]   = useState<string | null>(null);
  const [showCreds, setShowCreds] = useState(false);

  function navigate() {
    const dest = params.get("from") ?? "/";
    router.push(dest);
    router.refresh();
  }

  // auto-submit on 4th digit. `submit` and `mobile` are intentionally
  // excluded from deps — we only want this to fire off the pin transition,
  // not restart every time the user retypes the mobile.
  useEffect(() => {
    if (pin.length === 4 && mobile.trim()) {
      submit(pin);
    }
  }, [pin]);

  function submit(currentPin: string) {
    setError(null);
    start(async () => {
      const res = await loginByMobilePin(mobile.trim(), currentPin);
      if (!res.ok) {
        setError(res.error ?? "Login failed");
        setPin("");
        return;
      }
      navigate();
    });
  }

  function handleKey(k: string) {
    if (pending) return;
    if (k === "⌫") {
      setPin((p) => p.slice(0, -1));
      setError(null);
    } else if (pin.length < 4) {
      setPin((p) => p + k);
    }
  }

  function fillAccount(acc: typeof PIN_ACCOUNTS[number]) {
    setMobile(acc.mobile);
    setPin("");
    setError(null);
    setShowCreds(false);
  }

  return (
    <div className="w-full space-y-5">
      {/* Mobile input */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label
            htmlFor="pin-mobile"
            className="text-[11.5px] font-semibold tracking-[0.04em] uppercase"
            style={{ color: "#4A6462" }}
          >
            Mobile number
          </label>
          <button
            type="button"
            onClick={() => setShowCreds((v) => !v)}
            className="text-[10.5px] font-medium transition-colors"
            style={{ color: "#2BA89A" }}
          >
            {showCreds ? "Hide accounts" : "View accounts"}
          </button>
        </div>

        {/* Credentials picker */}
        {showCreds && (
          <div
            className="mb-2 rounded-[10px] overflow-hidden border"
            style={{ borderColor: "#C8E8E4", background: "#F0FBF9" }}
          >
            <div
              className="px-3 py-2 border-b text-[10.5px] font-semibold"
              style={{ borderColor: "#C8E8E4", color: "#1B8A7E" }}
            >
              Tap a row to fill · PIN is shown on right
            </div>
            <div className="max-h-[188px] overflow-y-auto">
              {PIN_ACCOUNTS.map((acc) => (
                <button
                  key={acc.mobile}
                  type="button"
                  onClick={() => fillAccount(acc)}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-[#D8F5F0] transition-colors border-b last:border-0 text-left"
                  style={{ borderColor: "#DDF0EC" }}
                >
                  <div>
                    <span className="text-[11.5px] font-semibold block" style={{ color: "#0F2A28" }}>
                      {acc.name}
                    </span>
                    <span className="text-[10px]" style={{ color: "#5A7A78" }}>{acc.role}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10.5px] font-mono block" style={{ color: "#5A7A78" }}>
                      {acc.mobile}
                    </span>
                    <span className="text-[11px] font-mono font-semibold tracking-[0.12em]" style={{ color: "#2BA89A" }}>
                      PIN {acc.pin}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <input
          id="pin-mobile"
          type="tel"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          placeholder="+91 98421 10001"
          autoComplete="tel"
          className="w-full h-[48px] rounded-[12px] px-4 text-[14px] outline-none transition-all"
          style={{ background: "#F0F8F7", border: "1.5px solid #C8DFD8", color: "#0F2A28" }}
          onFocus={focusStyle}
          onBlur={blurStyle}
        />
      </div>

      {/* PIN dots */}
      <div>
        <div
          className="text-[11.5px] font-semibold tracking-[0.04em] uppercase mb-3"
          style={{ color: "#4A6462" }}
        >
          4-digit PIN
        </div>
        <div className="flex justify-center gap-4 mb-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-4 h-4 rounded-full transition-all duration-150"
              style={{
                background: i < pin.length ? "#2BA89A" : "#D8EEEA",
                transform: i < pin.length ? "scale(1.15)" : "scale(1)",
              }}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <div
            className="mb-3 px-4 py-3 rounded-[10px] text-[12.5px] leading-snug text-center"
            style={{ background: "#FFF0EE", border: "1px solid #FFCBC4", color: "#B83A2E" }}
          >
            {error}
          </div>
        )}

        {/* Numeric keypad */}
        <div className="grid grid-cols-3 gap-2">
          {KEYPAD.map((k, idx) => {
            if (k === "") {
              // empty cell (bottom-right) — show loader when pending
              return (
                <div key={idx} className="h-[52px] flex items-center justify-center">
                  {pending && <Loader2 size={18} className="animate-spin" style={{ color: "#2BA89A" }} />}
                </div>
              );
            }
            if (k === "⌫") {
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleKey(k)}
                  disabled={pending || pin.length === 0}
                  className="h-[52px] rounded-[12px] flex items-center justify-center transition-all active:scale-95 disabled:opacity-30"
                  style={{ background: "#F0F8F7", border: "1.5px solid #D8EEEA" }}
                  aria-label="Delete"
                >
                  <Delete size={18} strokeWidth={1.75} style={{ color: "#5A7A78" }} />
                </button>
              );
            }
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleKey(k)}
                disabled={pending || pin.length >= 4}
                className="h-[52px] rounded-[12px] text-[20px] font-semibold transition-all active:scale-95 disabled:opacity-40"
                style={{
                  background: "#F0F8F7",
                  border: "1.5px solid #D8EEEA",
                  color: "#0F2A28",
                  fontFamily: "'Geist Mono', 'SF Mono', monospace",
                }}
              >
                {k}
              </button>
            );
          })}
        </div>

        {/* Manual submit (for when mobile is filled after PIN) */}
        {pin.length === 4 && !pending && (
          <button
            type="button"
            onClick={() => submit(pin)}
            className="mt-3 w-full h-[50px] rounded-[12px] flex items-center justify-center text-[14px] font-semibold text-white transition-all duration-200"
            style={{
              background: "linear-gradient(135deg, #2BA89A 0%, #1A8A7E 100%)",
              boxShadow: "0 4px 22px rgba(43,168,154,0.38)",
            }}
          >
            Sign In
          </button>
        )}
      </div>
    </div>
  );
}
