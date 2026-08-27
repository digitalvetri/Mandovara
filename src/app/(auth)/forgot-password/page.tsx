// "Forgot password?" — the login screen has linked here since it was
// written, and the route did not exist. Anyone who forgot their password
// hit a 404, which is the worst possible moment to show someone a broken
// page (found 2026-08-28).
//
// This is deliberately NOT a self-service reset. A reset link has to be
// delivered somewhere, and this deployment has no live email sender and
// no approved WhatsApp template yet — a form that silently sends nothing
// would be worse than no form. What staff need at this moment is to know
// exactly what to do, and that is what this page gives them.
//
// When the WABA is verified, this becomes an OTP flow: the mobile number
// is already the login identity, and admin/reset-password already exists
// as the privileged path behind it.

import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, KeyRound, MessageCircle, Phone } from "lucide-react";

export const metadata = { title: "Forgot password · Mandovara" };

const SUPPORT_MOBILE = "+91 89404 30051";
const SUPPORT_DIGITS = "918940430051";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10" style={{ background: "#F2F5F4" }}>
      <div className="w-full max-w-[420px]">
        <div className="rounded-[16px] border p-7" style={{ borderColor: "#DCE4E3", background: "#FFFFFF" }}>
          <div
            className="mb-4 grid h-10 w-10 place-items-center rounded-full"
            style={{ background: "#E3F1EE", color: "#007B6C" }}
          >
            <KeyRound size={18} strokeWidth={1.9} />
          </div>

          <h1 className="text-[20px] font-semibold" style={{ color: "#152324" }}>
            Reset your password
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "#4B5859" }}>
            Passwords here are reset by your administrator rather than by email,
            so nobody is locked out waiting for a message that may not arrive.
          </p>

          <ol className="mt-5 space-y-3">
            <Step n={1} text="Message or call the office on the number below, and say which mobile number you sign in with." />
            <Step n={2} text="They reset it from Admin and tell you the temporary password." />
            <Step n={3} text="Sign in with it — you'll be asked to choose a new one straight away." />
          </ol>

          <div className="mt-6 flex flex-col gap-2">
            <a
              href={`https://wa.me/${SUPPORT_DIGITS}?text=${encodeURIComponent("Hello, I need my Mandovara password reset. My login mobile number is ")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "#007B6C" }}
            >
              <MessageCircle size={15} strokeWidth={2} />
              Message on WhatsApp
            </a>
            <a
              href={`tel:${SUPPORT_DIGITS}`}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border text-[13.5px] font-medium transition-colors"
              style={{ borderColor: "#DCE4E3", color: "#152324" }}
            >
              <Phone size={14} strokeWidth={1.9} />
              {SUPPORT_MOBILE}
            </a>
          </div>
        </div>

        <Link
          href={"/login" as Route}
          className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] transition-opacity hover:opacity-70"
          style={{ color: "#4B5859" }}
        >
          <ArrowLeft size={13} />
          Back to sign in
        </Link>
      </div>
    </main>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <li className="flex gap-3">
      <span
        className="mt-[1px] grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full text-[11px] font-semibold"
        style={{ background: "#EDF2F1", color: "#007B6C" }}
      >
        {n}
      </span>
      <span className="text-[13px] leading-relaxed" style={{ color: "#4B5859" }}>{text}</span>
    </li>
  );
}
