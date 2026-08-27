"use client";

// Two owner controls that had no home until now.
//
// 1. Link staff records. Every user of this system is a member of staff
//    (owner instruction 2026-08-27), and new users now get an Employee
//    record automatically. Accounts created before that change don't
//    have one, and the symptom is opaque: "No staff record is linked to
//    your login" when they try to check in. This is the repair, in the
//    place the person who can fix it already works.
//
// 2. Audit-log retention. The owner asked for five days. The window is
//    a setting rather than a constant so it can be changed without a
//    deploy, and the purge is explicit rather than silent — you should
//    be able to see how much history you are about to destroy.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users, Trash2, Loader2, ShieldAlert } from "lucide-react";
import { backfillEmployeesForUsers } from "@/modules/admin/actions";
import { setAuditRetentionDays, purgeAuditLog } from "@/modules/admin/audit-retention";

export function PeopleAndAuditSection({ retentionDays }: { retentionDays: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [days, setDays]  = useState(String(retentionDays));
  const [msg, setMsg]    = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  function link(): void {
    setMsg(null);
    start(async () => {
      const res = await backfillEmployeesForUsers();
      if (!res.ok) { setMsg({ tone: "err", text: res.error ?? "Could not link staff records." }); return; }
      const d = res.data!;
      setMsg({
        tone: "ok",
        text: d.created === 0
          ? `Everyone is already linked (${d.alreadyLinked} staff records).`
          : `Created ${d.created} staff record${d.created === 1 ? "" : "s"}. ${d.alreadyLinked} were already linked.`,
      });
      router.refresh();
    });
  }

  function saveRetention(): void {
    setMsg(null);
    const n = parseInt(days, 10);
    if (!Number.isFinite(n) || n < 1) { setMsg({ tone: "err", text: "Enter a number of days, at least 1." }); return; }
    start(async () => {
      const res = await setAuditRetentionDays({ days: n });
      if (!res.ok) { setMsg({ tone: "err", text: res.error ?? "Could not save." }); return; }
      setMsg({ tone: "ok", text: `Audit history will be kept for ${n} day${n === 1 ? "" : "s"}.` });
      router.refresh();
    });
  }

  function purge(): void {
    setMsg(null);
    start(async () => {
      const res = await purgeAuditLog();
      if (!res.ok) { setMsg({ tone: "err", text: res.error ?? "Could not purge." }); return; }
      const d = res.data!;
      setMsg({
        tone: "ok",
        text: d.deleted === 0
          ? `Nothing to delete — no history is older than ${d.days} days.`
          : `Deleted ${d.deleted.toLocaleString("en-IN")} audit entries older than ${d.days} days.`,
      });
      router.refresh();
    });
  }

  return (
    <section className="overflow-hidden rounded-[14px] border border-rule bg-surface">
      <div className="border-b border-rule px-5 py-3.5">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
          People &amp; history
        </div>
      </div>

      <div className="divide-y divide-rule">
        {/* ── Staff records ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[13px] font-medium text-text">
              <Users size={13} className="text-text-dim" />
              Link staff records
            </div>
            <p className="mt-1 max-w-[54ch] text-[12px] text-text-dim">
              Everyone who logs in is a member of staff here. New users get a staff
              record automatically — run this once to create them for accounts added
              before that. Without one, a person cannot check in or be paid.
            </p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={link}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[8px] border border-rule px-4 text-[12.5px] font-medium text-text transition-colors hover:border-accent disabled:opacity-60"
          >
            {pending && <Loader2 size={12} className="animate-spin" />}
            Link staff records
          </button>
        </div>

        {/* ── Audit retention ── */}
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 text-[13px] font-medium text-text">
            <ShieldAlert size={13} className="text-text-dim" />
            Audit history
          </div>
          <p className="mt-1 max-w-[62ch] text-[12px] text-text-dim">
            How long to keep the record of who changed what. Entries can never be
            edited, at any age. Anything inside this window cannot be deleted either
            — not by anyone, including from here.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label htmlFor="retention-days" className="text-[12px] text-text-dim">Keep for</label>
            <input
              id="retention-days"
              type="number"
              min={1}
              max={3650}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="tabular h-9 w-[84px] rounded-[8px] border border-rule bg-transparent px-3 text-[12.5px] text-text focus:border-accent focus:outline-none"
            />
            <span className="text-[12px] text-text-dim">days</span>
            <button
              type="button"
              disabled={pending}
              onClick={saveRetention}
              className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-accent px-4 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              Save
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={purge}
              className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-bad/30 px-4 text-[12.5px] font-medium text-bad transition-colors hover:bg-bad/8 disabled:opacity-60"
            >
              {pending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              Delete older entries
            </button>
          </div>

          {retentionDays <= 7 && (
            <p className="mt-2.5 max-w-[62ch] rounded-[8px] border-l-2 border-warn bg-warn/8 px-3 py-2 text-[11.5px] text-text">
              At {retentionDays} days, a dispute raised about last week&apos;s work will
              have no record behind it. Dye-lot and quantity questions in this trade
              often surface weeks later — 90 days costs almost nothing to keep.
            </p>
          )}
        </div>
      </div>

      {msg && (
        <div className={`border-t border-rule px-5 py-2.5 text-[12px] ${msg.tone === "ok" ? "text-good" : "text-bad"}`}>
          {msg.text}
        </div>
      )}
    </section>
  );
}
