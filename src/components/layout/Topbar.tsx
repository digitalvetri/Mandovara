"use client";

import type { ReactNode } from "react";
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
  return (
    <header className="py-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-6">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-1.5 text-[10.5px] font-semibold tracking-[0.18em] uppercase text-text-dim">
            {eyebrow}
          </div>
        )}
        <h1 className="font-display text-[26px] sm:text-[30px] xl:text-[34px] leading-tight font-semibold text-text break-words tracking-[-0.015em]">
          {title}
        </h1>
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 pt-1">
          {actions}
        </div>
      )}
    </header>
  );
}

export function PrimaryButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 h-[38px] px-4 rounded-[8px]
                 bg-accent text-white text-[12.5px] font-medium
                 hover:bg-accent-hover transition-colors whitespace-nowrap"
    >
      <Plus size={14} strokeWidth={2.25} />
      {children}
    </button>
  );
}
