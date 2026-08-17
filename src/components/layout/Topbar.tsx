"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Plus } from "lucide-react";

interface TopbarProps {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  /** @deprecated showSchedule no longer controls a calendar menu in this component */
  showSchedule?: boolean;
}

// Inline page header — sits inside the scrollable content area below the
// GlobalTopbar. Provides the page title, an optional eyebrow line, and
// a slot for page-specific primary action buttons.
// Search, notifications, theme toggle and user chip live in GlobalTopbar.

export function Topbar({ title, eyebrow, actions }: TopbarProps) {
  // Empty title → render nothing (some pages own their own header).
  if (!title && !eyebrow && !actions) return null;

  return (
    <header className="pb-4 pt-1 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-6">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-1.5 text-[11px] font-semibold tracking-[0.18em] uppercase text-text-dim">
            {eyebrow}
          </div>
        )}
        {title && (
          <h1 className="font-display text-[28px] sm:text-[32px] xl:text-[36px] leading-tight font-semibold text-text break-words tracking-[-0.015em]">
            {title}
          </h1>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 pt-1">
          {actions}
        </div>
      )}
    </header>
  );
}

const PRIMARY_BUTTON_CLS =
  "inline-flex items-center gap-1.5 h-[38px] px-4 rounded-[8px]" +
  " bg-accent text-white text-[12.5px] font-medium" +
  " hover:bg-accent-hover transition-colors whitespace-nowrap cursor-pointer";

/** Gold-adjacent primary CTA. Accepts either `href` (renders a Link) or
 *  `onClick` (renders a button). Previously always rendered as `<button>`
 *  which meant wrapping it in a `<Link>` produced invalid `<a><button>`
 *  nesting — clicks on some browsers stopped propagating to the anchor and
 *  navigation silently didn't fire (that was the "Record Payment does
 *  nothing" bug). */
export function PrimaryButton({
  children, href, onClick, type,
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  if (href !== undefined) {
    return (
      <Link href={href as Route} className={PRIMARY_BUTTON_CLS}>
        <Plus size={14} strokeWidth={2.25} />
        {children}
      </Link>
    );
  }
  return (
    <button
      type={type ?? "button"}
      onClick={onClick}
      className={PRIMARY_BUTTON_CLS}
    >
      <Plus size={14} strokeWidth={2.25} />
      {children}
    </button>
  );
}
