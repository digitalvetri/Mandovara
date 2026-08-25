"use client";

// Shared ⋮ dropdown for list cards. Manages its own open/confirm
// state so parent components stay clean.
//
// The dropdown itself is rendered through a document.body portal — most
// tables in this app wrap themselves in `overflow-hidden` to enforce
// rounded corners, which was clipping the menu on the last few rows
// and revealing only "Edit". The portal sidesteps all ancestor
// overflow / clipping / stacking context issues.

import { Fragment, useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
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

const MENU_WIDTH = 200;

export function MoreMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen]             = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [coords, setCoords]         = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted]       = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  // Portal requires document — mark mounted on the client.
  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    // Right-align to the button, drop below it. If it would spill off the
    // right edge, clamp to the viewport. If it would spill off the bottom,
    // flip above.
    const gutter = 8;
    const menuMaxHeight = Math.min(320, items.length * 32 + 32);
    let left = rect.right - MENU_WIDTH;
    if (left + MENU_WIDTH > window.innerWidth - gutter) {
      left = window.innerWidth - MENU_WIDTH - gutter;
    }
    if (left < gutter) left = gutter;
    let top = rect.bottom + 4;
    if (top + menuMaxHeight > window.innerHeight - gutter) {
      top = Math.max(gutter, rect.top - menuMaxHeight - 4);
    }
    setCoords({ top, left });
  }, [open, items.length]);

  // Close on outside click / scroll / resize.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (btnRef.current?.contains(e.target as Node)) return;
      const menu = document.getElementById("more-menu-portal");
      if (menu?.contains(e.target as Node)) return;
      setOpen(false); setConfirming(null);
    }
    function onScroll() { setOpen(false); setConfirming(null); }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

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

  const menu = open && coords && (
    <div
      id="more-menu-portal"
      style={{ position: "fixed", top: coords.top, left: coords.left, width: MENU_WIDTH, zIndex: 60 }}
      className="rounded-[10px] bg-surface border border-rule shadow-xl py-1 overflow-hidden"
    >
      {confirmItem ? (
        <div className="px-3 py-2.5">
          <div className="flex items-start gap-2 mb-2.5">
            <AlertTriangle size={12} className="text-fault shrink-0 mt-px" />
            <p className="text-[11.5px] text-text leading-snug">{confirmItem.confirm}</p>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
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
                <Link href={item.href as Route} className={cls} onClick={() => setOpen(false)}>
                  <item.icon size={12} strokeWidth={1.75} className={iconCls} />
                  {item.label}
                </Link>
              ) : (
                <button
                  type="button"
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
  );

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        type="button"
        onClick={() => { setOpen((p) => !p); setConfirming(null); }}
        className="h-7 w-7 grid place-items-center rounded-[6px] text-text-dim border border-rule hover:text-text hover:bg-surface-2 transition-colors"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal size={13} strokeWidth={2} />
      </button>
      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
