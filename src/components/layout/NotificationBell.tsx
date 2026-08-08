"use client";

// Notification bell + dropdown, mounted in the Topbar.
//
// - Loads the recent list + unread count on mount, and again whenever
//   the dropdown opens (so a badge cleared by another tab shows up).
// - "Mark all read" clears the count without refetching the list —
//   the list still shows the just-cleared items visually so the user
//   can see what they missed; the badge disappears immediately.
// - Clicking a notification with an entity link both marks it read
//   (server-side) and navigates to the target.

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Bell, CheckCheck } from "lucide-react";
import {
  fetchRecentNotifications, fetchUnreadCount,
  markNotificationRead, markAllNotificationsRead,
} from "@/modules/notifications/actions";
import type { NotificationRow } from "@/modules/notifications/queries";

const LEVEL_TONE: Record<string, string> = {
  INFO:    "bg-info/12 text-info",
  SUCCESS: "bg-good/12 text-good",
  WARN:    "bg-warn/12 text-warn",
  WARNING: "bg-warn/12 text-warn",
  ERROR:   "bg-bad/12 text-bad",
};

// Map entityType → route base. Keeps the click handler declarative.
const ENTITY_ROUTES: Record<string, (id: string) => string> = {
  CLIENT:      (id) => `/clients/${id}`,
  PROJECT:     (id) => `/projects/${id}`,
  LEAD:        (id) => `/leads/${id}`,
  QUOTATION:   (id) => `/quotations/${id}`,
  ORDER:       (id) => `/orders/${id}`,
  SALES_ORDER: (id) => `/orders/${id}`,
  INVOICE:     (id) => `/invoicing/${id}`,
  PRODUCT:     (id) => `/products/${id}`,
  VENDOR:      (id) => `/purchase/vendors/${id}`,
};

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen]         = useState(false);
  const [items, setItems]       = useState<NotificationRow[]>([]);
  const [unread, setUnread]     = useState(0);
  const [loading, setLoading]   = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, count] = await Promise.all([
        fetchRecentNotifications(),
        fetchUnreadCount(),
      ]);
      setItems(list);
      setUnread(count);
    } catch {
      /* silent — bell isn't critical UX */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (open) void load(); }, [open, load]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  function clickItem(n: NotificationRow) {
    // Optimistically flip local state, fire server mark-read, then
    // navigate if it has a linked entity.
    if (!n.readAt) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date() } : x)));
      setUnread((c) => Math.max(0, c - 1));
      startTransition(async () => {
        await markNotificationRead({ id: n.id });
        router.refresh();
      });
    }
    if (n.entityType && n.entityId) {
      const href = ENTITY_ROUTES[n.entityType]?.(n.entityId);
      if (href) {
        setOpen(false);
        router.push(href as Route);
      }
    }
  }

  function markAll() {
    if (unread === 0) return;
    // Optimistic.
    setItems((prev) => prev.map((x) => (x.readAt ? x : { ...x, readAt: new Date() })));
    setUnread(0);
    startTransition(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `${unread} unread notifications` : "Notifications"}
        title={unread > 0 ? `${unread} unread notifications` : "Notifications"}
        className="h-[38px] w-[38px] inline-flex items-center justify-center rounded-[8px] bg-surface border border-rule text-text-dim hover:text-text hover:bg-surface-hover transition-colors relative"
      >
        <Bell size={15} strokeWidth={1.9} />
        {unread > 0 && (
          <span className="absolute top-[6px] right-[6px] min-w-[16px] h-[16px] px-[3px] rounded-full bg-accent text-white text-[9.5px] font-medium tabular-nums flex items-center justify-center leading-none">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[380px] max-w-[92vw] rounded-[12px] bg-surface border border-rule shadow-xl overflow-hidden z-40">
          <div className="px-4 py-3 border-b border-rule flex items-center justify-between">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
              Notifications {unread > 0 && <span className="text-accent">· {unread} unread</span>}
            </div>
            <button
              type="button"
              onClick={markAll}
              disabled={pending || unread === 0}
              className="inline-flex items-center gap-1 text-[11px] text-text-dim hover:text-text disabled:opacity-40"
            >
              <CheckCheck size={11} /> Mark all read
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="py-10 text-center text-[12px] text-text-dim">Loading…</div>
            ) : items.length === 0 ? (
              <div className="py-10 text-center text-[12px] text-text-dim">
                No notifications.
              </div>
            ) : (
              <ul>
                {items.map((n) => {
                  const isUnread = n.readAt == null;
                  const hasLink  = !!(n.entityType && n.entityId && ENTITY_ROUTES[n.entityType]);
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => clickItem(n)}
                        className={`w-full text-left px-4 py-3 border-b border-rule/60 last:border-0 hover:bg-surface-hover transition-colors flex items-start gap-3 ${
                          isUnread ? "" : "opacity-60"
                        }`}
                      >
                        <span
                          className={`mt-1 h-[8px] w-[8px] rounded-full shrink-0 ${
                            isUnread ? "bg-accent" : "bg-text-faint"
                          }`}
                          aria-hidden
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded-[6px] text-[9.5px] uppercase tracking-[0.06em] ${LEVEL_TONE[n.level] ?? "bg-white/8 text-text-dim"}`}>
                              {n.level.toLowerCase()}
                            </span>
                            <span className="text-[12.5px] text-text truncate">{n.title}</span>
                          </div>
                          {n.body && (
                            <div className="mt-0.5 text-[11.5px] text-text-dim line-clamp-2">{n.body}</div>
                          )}
                          <div className="mt-1 text-[10.5px] text-text-faint tabular flex items-center gap-2">
                            <span>{relativeTime(n.createdAt)}</span>
                            {hasLink && <span className="text-accent">Open →</span>}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Rough en-IN relative time; no dependency on date-fns.
function relativeTime(d: Date): string {
  const then = new Date(d).getTime();
  const now  = Date.now();
  const sec  = Math.max(0, Math.floor((now - then) / 1000));
  if (sec < 60)         return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60)         return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)          return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7)          return `${day}d ago`;
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", timeZone: "Asia/Kolkata",
  });
}
