"use client";

import { useTransition, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { CheckCheck, MapPin } from "lucide-react";
import {
  markNotificationRead, markAllNotificationsRead,
} from "@/modules/notifications/actions";
import type {
  NotificationRow, NotificationFilter,
} from "@/modules/notifications/queries";

const LEVEL_TONE: Record<string, string> = {
  INFO:    "bg-info/12 text-info",
  SUCCESS: "bg-good/12 text-good",
  WARN:    "bg-warn/12 text-warn",
  WARNING: "bg-warn/12 text-warn",
  ERROR:   "bg-bad/12 text-bad",
  VISIT:   "bg-heat/12 text-heat",
};

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

interface Props {
  rows:         NotificationRow[];
  counts:       { all: number; unread: number; read: number };
  activeFilter: NotificationFilter;
}

export function NotificationsPage({ rows, counts, activeFilter }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localRows, setLocalRows]  = useState(rows);
  const [localUnread, setLocalUnread] = useState(counts.unread);

  function clickRow(n: NotificationRow) {
    // Site visit rows have no FollowUp record to mark read — just navigate
    if (!n.readAt && n.kind !== "sitevisit") {
      setLocalRows((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date() } : x)));
      setLocalUnread((c) => Math.max(0, c - 1));
      startTransition(async () => {
        await markNotificationRead({ id: n.id });
        router.refresh();
      });
    }
    if (n.entityType && n.entityId) {
      const href = ENTITY_ROUTES[n.entityType]?.(n.entityId);
      if (href) router.push(href as Route);
    }
  }

  function markAll() {
    if (localUnread === 0) return;
    // Only follow-up rows can be marked read server-side
    setLocalRows((prev) => prev.map((x) => (x.readAt || x.kind === "sitevisit" ? x : { ...x, readAt: new Date() })));
    setLocalUnread((c) => {
      const svCount = localRows.filter(r => r.kind === "sitevisit" && !r.readAt).length;
      return svCount; // site visit "unread" count remains
    });
    startTransition(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  }

  return (
    <>
      {/* Filter tabs + mark-all-read */}
      <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 rounded-[8px] bg-surface border border-rule p-1">
          <FilterTab filter="UNREAD" active={activeFilter === "UNREAD"} count={counts.unread} label="Unread" />
          <FilterTab filter="ALL"    active={activeFilter === "ALL"}    count={counts.all}    label="All" />
          <FilterTab filter="READ"   active={activeFilter === "READ"}   count={counts.read}   label="Read" />
        </div>
        <button
          type="button"
          onClick={markAll}
          disabled={pending || localUnread === 0}
          className="inline-flex items-center gap-1.5 h-[34px] px-3 rounded-[6px] bg-surface border border-rule text-[12px] text-text-dim hover:text-text hover:bg-surface-hover disabled:opacity-40 transition-colors"
        >
          <CheckCheck size={13} /> Mark all read
        </button>
      </div>

      {/* List */}
      {localRows.length === 0 ? (
        <div className="rounded-[14px] bg-surface border border-rule py-16 text-center">
          <div className="text-[14px] text-text mb-2">
            {activeFilter === "UNREAD"
              ? "No unread notifications."
              : activeFilter === "READ"
              ? "No read notifications yet."
              : "No notifications."}
          </div>
          <p className="text-[12px] text-text-dim">
            Follow-ups, payment reminders and stock alerts will land here.
          </p>
        </div>
      ) : (
        <ul className="rounded-[14px] bg-surface border border-rule overflow-hidden divide-y divide-rule/70">
          {localRows.map((n) => {
            const isUnread = n.readAt == null;
            const hasLink  = !!(n.entityType && n.entityId && ENTITY_ROUTES[n.entityType]);
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => clickRow(n)}
                  className={`w-full text-left px-5 py-4 hover:bg-surface-hover transition-colors flex items-start gap-4 ${
                    isUnread ? "" : "opacity-65"
                  }`}
                >
                  <span
                    className={`mt-[6px] h-[8px] w-[8px] rounded-full shrink-0 ${
                      isUnread ? "bg-accent" : "bg-text-faint"
                    }`}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-[6px] text-[10px] uppercase tracking-[0.06em] ${LEVEL_TONE[n.level] ?? "bg-white/8 text-text-dim"}`}>
                        {n.kind === "sitevisit" ? "site visit" : n.level.toLowerCase()}
                      </span>
                      {n.kind === "sitevisit" && <MapPin size={11} strokeWidth={2} className="text-heat shrink-0" />}
                      <span className="text-[13.5px] text-text">{n.title}</span>
                      {hasLink && (
                        <span className="text-[11px] text-accent uppercase tracking-[0.08em]">
                          {n.entityType?.replace("_", " ").toLowerCase()} →
                        </span>
                      )}
                    </div>
                    {n.body && (
                      <div className="mt-1 text-[12.5px] text-text-dim">{n.body}</div>
                    )}
                    <div className="mt-1 text-[11px] text-text-faint tabular">
                      {formatFull(n.createdAt)}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function FilterTab({
  filter, active, count, label,
}: { filter: NotificationFilter; active: boolean; count: number; label: string }) {
  const href = filter === "UNREAD" ? "/notifications" : `/notifications?filter=${filter}`;
  return (
    <Link
      href={href as Route}
      className={`h-[30px] px-3 inline-flex items-center gap-2 rounded-[6px] text-[12px] transition-colors ${
        active ? "bg-accent/12 text-text" : "text-text-dim hover:text-text hover:bg-surface-hover"
      }`}
    >
      {label}
      <span className={`tabular text-[10.5px] ${active ? "text-accent" : "text-text-faint"}`}>{count}</span>
    </Link>
  );
}

function formatFull(d: Date): string {
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}
