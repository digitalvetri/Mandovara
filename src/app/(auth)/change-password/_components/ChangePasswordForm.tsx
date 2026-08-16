"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Eye, EyeOff, ArrowRight } from "lucide-react";
import { changePassword, devLogout } from "@/lib/dev-auth";

interface Props { forced: boolean }

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

const MIN_LEN = 10;

export function ChangePasswordForm({ forced }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const strengthOk = next.length >= MIN_LEN;
  const match = confirm.length > 0 && next === confirm;
  const canSubmit = current.length > 0 && strengthOk && match;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setOkMsg(null);
    start(async () => {
      const r = await changePassword(current, next);
      if (!r.ok) { setError(r.error ?? "Could not change password"); return; }
      setOkMsg("Password changed. Signing you out…");
      // Sign the user out so the next visit forces a fresh login with
      // the new password — cleanly resets the session state.
      await devLogout();
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field
        id="cp-current"
        label="Current password"
        type={showCur ? "text" : "password"}
        value={current}
        onChange={setCurrent}
        autoComplete="current-password"
        autoFocus
        showToggle={showCur}
        onToggle={() => setShowCur((v) => !v)}
      />

      <Field
        id="cp-new"
        label="New password"
        type={showNew ? "text" : "password"}
        value={next}
        onChange={setNext}
        autoComplete="new-password"
        showToggle={showNew}
        onToggle={() => setShowNew((v) => !v)}
        hint={
          next.length === 0
            ? `Minimum ${MIN_LEN} characters`
            : strengthOk
              ? "Looks good"
              : `${next.length} of ${MIN_LEN} characters`
        }
        hintOk={strengthOk}
      />

      <Field
        id="cp-confirm"
        label="Confirm new password"
        type={showNew ? "text" : "password"}
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
        hint={
          confirm.length === 0
            ? "Type the new password again"
            : match
              ? "Matches"
              : "Doesn't match"
        }
        hintOk={match}
      />

      {error && (
        <div
          className="px-4 py-2.5 rounded-[10px] text-[12.5px] leading-snug"
          style={{ background: "#FFF0EE", border: "1px solid #FFCBC4", color: "#B83A2E" }}
        >
          {error}
        </div>
      )}
      {okMsg && (
        <div
          className="px-4 py-2.5 rounded-[10px] text-[12.5px] leading-snug"
          style={{ background: "#EFFBF3", border: "1px solid #B8E5C6", color: "#1B7A3D" }}
        >
          {okMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={pending || !canSubmit}
        className="w-full h-[48px] rounded-[12px] flex items-center justify-center gap-2 text-[14px] font-semibold text-white transition-all active:scale-[0.99]"
        style={{
          background: pending || !canSubmit
            ? "#A8D5CF"
            : "linear-gradient(135deg, #2BA89A 0%, #1A8A7E 100%)",
          boxShadow:  pending || !canSubmit ? "none" : "0 4px 22px rgba(43,168,154,0.34)",
          cursor:     pending || !canSubmit ? "not-allowed" : "pointer",
        }}
      >
        {pending
          ? <Loader2 size={16} className="animate-spin" />
          : <><span>Change Password</span><ArrowRight size={15} strokeWidth={2.2} /></>}
      </button>

      {!forced && (
        <button
          type="button"
          onClick={() => router.push("/")}
          className="w-full text-[12px] text-center py-2"
          style={{ color: "#7A9A98" }}
        >
          Cancel
        </button>
      )}
    </form>
  );
}

interface FieldProps {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  autoFocus?: boolean;
  hint?: string;
  hintOk?: boolean;
  showToggle?: boolean;
  onToggle?: () => void;
}

function Field({
  id, label, type, value, onChange, autoComplete, autoFocus,
  hint, hintOk, showToggle, onToggle,
}: FieldProps) {
  const showEye = onToggle !== undefined;
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[11px] font-semibold mb-1.5 tracking-[0.04em] uppercase"
        style={{ color: "#4A6462" }}
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          autoComplete={autoComplete}
          autoFocus={autoFocus ?? false}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-[46px] rounded-[12px] px-4 pr-11 text-[13.5px] outline-none transition-all"
          style={{ background: "#F0F8F7", border: "1.5px solid #C8DFD8", color: "#0F2A28" }}
          onFocus={focusStyle}
          onBlur={blurStyle}
        />
        {showEye && (
          <button
            type="button"
            tabIndex={-1}
            onClick={onToggle}
            className="absolute right-3.5 top-1/2 -translate-y-1/2"
            style={{ color: "#7A9A98" }}
            aria-label={showToggle ? "Hide" : "Show"}
          >
            {showToggle
              ? <EyeOff size={15} strokeWidth={1.8} />
              : <Eye size={15} strokeWidth={1.8} />}
          </button>
        )}
      </div>
      {hint && (
        <div
          className="mt-1 text-[10.5px]"
          style={{ color: hintOk ? "#1B7A3D" : "#7A9A98" }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}
