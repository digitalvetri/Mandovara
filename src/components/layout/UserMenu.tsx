"use client";

// The account menu behind the header chip.
//
// Owner, 2026-08-30: "i need to open setting section where the admin can
// maintain his profile and company profile and also change his email , or
// reset password , profile image all this should open when they click".
//
// Every one of those already existed — /profile edits the email, the mobile
// and the photograph, /change-password rotates the password, and company
// settings sit on /admin. What did not exist was any way to reach them from
// the header: the chip was a <div> with cursor-default, so it looked like a
// button, invited a click, and did nothing.
//
// Sign out moves in here too. The bar was carrying six separate controls —
// search, bell, calendar, theme, chip, sign out — competing for the same
// row, which is most of why it read as cluttered, and is what squeezed the
// search field to 29px on a phone.

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, User, Building2, KeyRound, LogOut, Loader2 } from "lucide-react";
import { devLogout } from "@/lib/dev-auth";

interface Props {
  userName:   string;
  userRole:   string;
  userEmail:  string | null;
  userAvatar: string | null;
  /** Company settings live on /admin; only offer it to someone who may edit them. */
  canManageCompany: boolean;
  roleLabel:  string;
  initials:   string;
}

export function UserMenu({
  userName, userEmail, userAvatar, canManageCompany, roleLabel, initials,
}: Props) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  // Click-to-open, never hover: a hover menu is unreachable by a finger, and
  // the responsive gate fails any control that needs one.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  // A menu still open over a page you have already left is a small haunting.
  useEffect(() => { setOpen(false); }, [pathname]);

  async function signOut() {
    setSigningOut(true);
    await devLogout();
    router.push("/login");
    router.refresh();
  }

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex h-[38px] items-center gap-2.5 rounded-[10px] border px-2 sm:px-3 on-chrome transition-colors"
      >
        <Avatar src={userAvatar} initials={initials} />
        <div className="hidden leading-none lg:block text-left">
          <div className="text-[12px] font-medium on-chrome-text">{userName}</div>
          <div className="mt-[2.5px] text-[10px] on-chrome-dim">{roleLabel}</div>
        </div>
        <ChevronDown
          size={13}
          strokeWidth={2}
          className={`hidden sm:block on-chrome-dim transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[248px] overflow-hidden rounded-[12px] border border-rule bg-surface shadow-2xl shadow-ink/30"
        >
          <div className="flex items-center gap-3 border-b border-rule px-3.5 py-3">
            <Avatar src={userAvatar} initials={initials} large />
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-text">{userName}</div>
              <div className="truncate text-[11.5px] text-text-dim">
                {userEmail ?? roleLabel}
              </div>
            </div>
          </div>

          <div className="py-1">
            <Item href="/profile" icon={<User size={13} strokeWidth={1.75} />}>
              My profile &amp; photo
            </Item>
            <Item href="/change-password" icon={<KeyRound size={13} strokeWidth={1.75} />}>
              Change password
            </Item>
            {canManageCompany && (
              <Item href="/admin#company" icon={<Building2 size={13} strokeWidth={1.75} />}>
                Company &amp; admin
              </Item>
            )}
          </div>

          <div className="border-t border-rule py-1">
            <button
              type="button"
              role="menuitem"
              onClick={signOut}
              disabled={signingOut}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[12.5px] text-text-dim transition-colors hover:bg-surface-hover hover:text-fault disabled:opacity-60"
            >
              {signingOut
                ? <Loader2 size={13} className="animate-spin" />
                : <LogOut size={13} strokeWidth={1.75} />}
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Avatar({ src, initials, large }: { src: string | null; initials: string; large?: boolean }) {
  const size = large ? "h-9 w-9 text-[12px]" : "h-[26px] w-[26px] text-[10px]";
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`${size} shrink-0 rounded-full object-cover`}
      />
    );
  }
  return (
    <div className={`${size} flex shrink-0 items-center justify-center rounded-full bg-accent-chrome font-bold text-ink`}>
      {initials}
    </div>
  );
}

function Item({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href as Route}
      role="menuitem"
      className="flex items-center gap-2.5 px-3.5 py-2.5 text-[12.5px] text-text transition-colors hover:bg-surface-hover"
    >
      <span className="text-text-dim">{icon}</span>
      {children}
    </Link>
  );
}
