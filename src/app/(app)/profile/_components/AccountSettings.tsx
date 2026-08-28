"use client";

// Account settings — password, notifications, sign-in activity.
//
// On sessions, the honest position: this app has no server-side session
// store. A session is a signed cookie (src/lib/session.ts) verified by
// HMAC on each request, with nothing persisted to revoke or enumerate.
// So a list of "currently active login sessions" cannot be produced —
// inventing one would be a security feature that does not work, which is
// worse than none. What IS true is shown: when this account last signed
// in, and how to end a session. Building a real list needs a Session
// table; that is a schema change, not a screen.

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { KeyRound, Bell, Monitor, Loader2, Check } from "lucide-react";
import { updateMyNotifyPrefs } from "@/modules/profile/actions";

interface Props {
  notifyEmail: boolean;
  notifyApp:   boolean;
  lastLoginAt: string | null;
  hasEmail:    boolean;
}

export function AccountSettings({ notifyEmail, notifyApp, lastLoginAt, hasEmail }: Props) {
  const [email, setEmail] = useState(notifyEmail);
  const [app,   setApp]   = useState(notifyApp);
  const [saved, setSaved] = useState(false);
  const [pending, start]  = useTransition();

  function save(nextEmail: boolean, nextApp: boolean) {
    setEmail(nextEmail); setApp(nextApp); setSaved(false);
    start(async () => {
      const r = await updateMyNotifyPrefs({ email: nextEmail, app: nextApp });
      if (r.ok) setSaved(true);
    });
  }

  return (
    <div className="rounded-[16px] border border-border bg-surface">
      <div className="border-b border-border px-5 py-3.5">
        <h2 className="text-[13px] font-semibold text-text">Account settings</h2>
      </div>

      {/* Password */}
      <Row
        icon={<KeyRound size={14} strokeWidth={1.8} />}
        title="Password"
        sub="Change the password you sign in with."
        action={
          <Link
            href={"/change-password" as Route}
            className="inline-flex h-[32px] items-center rounded-[6px] border border-border px-3 text-[12.5px] text-text-muted transition-colors hover:border-gold hover:text-text"
          >
            Change password
          </Link>
        }
      />

      {/* Notifications */}
      <Row
        icon={<Bell size={14} strokeWidth={1.8} />}
        title="Notifications"
        sub={hasEmail ? "Where we reach you about tasks and approvals." : "Add an email above to enable email alerts."}
        action={
          <div className="flex items-center gap-3">
            {pending && <Loader2 size={13} className="animate-spin text-text-muted" />}
            {saved && !pending && (
              <span className="inline-flex items-center gap-1 text-[12px] text-solid">
                <Check size={12} /> Saved
              </span>
            )}
          </div>
        }
      >
        <div className="mt-3 space-y-2">
          <Toggle
            label="In-app notifications"
            checked={app}
            onChange={(v) => save(email, v)}
          />
          <Toggle
            label="Email notifications"
            checked={email}
            disabled={!hasEmail}
            onChange={(v) => save(v, app)}
          />
        </div>
      </Row>

      {/* Sessions */}
      <Row
        icon={<Monitor size={14} strokeWidth={1.8} />}
        title="Sign-in activity"
        sub={
          lastLoginAt
            ? `Last signed in ${new Date(lastLoginAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}.`
            : "No sign-in recorded yet."
        }
        last
      >
        <p className="mt-2 text-[12.5px] text-text-muted">
          Sessions are held in a signed cookie rather than on the server, so a
          list of active devices is not available. Signing out ends the session
          on this device; if you think someone else has your password, change it
          above.
        </p>
      </Row>
    </div>
  );
}

function Row({
  icon, title, sub, action, children, last,
}: {
  icon: React.ReactNode; title: string; sub: string;
  action?: React.ReactNode; children?: React.ReactNode; last?: boolean;
}) {
  return (
    <div className={`px-5 py-4 ${last ? "" : "border-b border-border/60"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 text-text-muted">{icon}</span>
          <div className="min-w-0">
            <div className="text-[13.5px] font-medium text-text">{title}</div>
            <div className="mt-0.5 text-[12.5px] text-text-muted">{sub}</div>
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Toggle({
  label, checked, onChange, disabled,
}: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`flex items-center gap-2.5 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-[15px] w-[15px] accent-gold"
      />
      <span className="text-[13px] text-text">{label}</span>
    </label>
  );
}
