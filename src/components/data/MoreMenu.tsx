"use client";

// Shared ⋮ dropdown for list cards. Manages its own open/confirm
// state so parent components stay clean.

import { Fragment, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { MoreHorizontal, AlertTriangle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface MenuItem {
  key:           string;
  label:         string;
  icon:          LucideIcon;
  href?:         string;
  danger?:       boolean;
  separator?:    boolean;
  confirm?:      string;
  confirmLabel?: string;
  onClick?:      () => void;
}

export function MoreMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen]             = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  function handleBlur() {
    setTimeout(() => { setOpen(false); setConfirming(null); }, 150);
  }

  function handleItemClick(item: MenuItem) {
    if (item.confirm) {
      setConfirming(item.key);
    } else {
      item.onClick?.();
      setOpen(false);
    }
  }

  function handleConfirm() {
    const item = items.find((i) => i.key === confirming);
    item?.onClick?.();
    setOpen(false);
    setConfirming(null);
  }

  const confirmItem = confirming ? items.find((i) => i.key === confirming) : null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { setOpen((p) => !p); setConfirming(null); }}
        onBlur={handleBlur}
        className="h-7 w-7 grid place-items-center rounded-[6px] text-text-dim border border-rule hover:text-text hover:bg-surface-2 transition-colors"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal size={13} strokeWidth={2} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-[200px] rounded-[10px] bg-surface border border-rule shadow-xl py-1 overflow-hidden">
          {confirmItem ? (
            <div className="px-3 py-2.5">
              <div className="flex items-start gap-2 mb-2.5">
                <AlertTriangle size={12} className="text-fault shrink-0 mt-px" />
                <p className="text-[11.5px] text-text leading-snug">{confirmItem.confirm}</p>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleConfirm}
                  className={[
                    "flex-1 h-7 rounded-[5px] text-[11.5px] font-medium hover:opacity-90 transition-opacity",
                    confirmItem.danger
                      ? "bg-fault text-white"
                      : "bg-surface-2 text-text border border-rule",
                  ].join(" ")}
                >
                  {confirmItem.confirmLabel ?? (confirmItem.danger ? "Delete" : "Confirm")}
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setConfirming(null)}
                  className="flex-1 h-7 rounded-[5px] text-[11.5px] text-text-dim border border-rule bg-surface-2 hover:text-text transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            items.map((item) => {
              const cls = [
                "flex items-center gap-2.5 w-full px-3 h-8 text-[12.5px] text-left transition-colors hover:bg-surface-hover",
                item.danger ? "text-fault" : "text-text",
              ].join(" ");
              const iconCls = item.danger ? "text-fault" : "text-text-dim";

              return (
                <Fragment key={item.key}>
                  {item.separator && <hr className="border-rule mx-3 my-1" />}
                  {item.href ? (
                    <Link
                      href={item.href as Route}
                      onMouseDown={(e) => e.preventDefault()}
                      className={cls}
                    >
                      <item.icon size={12} strokeWidth={1.75} className={iconCls} />
                      {item.label}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleItemClick(item)}
                      className={cls}
                    >
                      <item.icon size={12} strokeWidth={1.75} className={iconCls} />
                      {item.label}
                    </button>
                  )}
                </Fragment>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
