"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMakeJob } from "@/modules/make/actions";

interface Props {
  orders:  { id: string; label: string }[];
  vendors: { id: string; name: string }[];
  users:   { id: string; name: string }[];
}

const PRIORITY_OPTIONS = [
  { value: "0", label: "Normal" },
  { value: "1", label: "High" },
  { value: "2", label: "Urgent" },
];

export function CreateMakeJobForm({ orders, vendors, users }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [orderId, setOrderId]       = useState("");
  const [vendorId, setVendorId]     = useState("");
  const [assignedToId, setAssigned] = useState("");
  const [priority, setPriority]     = useState("0");
  const [targetDate, setTarget]     = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orderId) { setError("Please select an order."); return; }
    setError(null);
    start(async () => {
      const r = await createMakeJob({
        orderId,
        vendorId:     vendorId || undefined,
        assignedToId: assignedToId || undefined,
        priority:     Number(priority),
        targetDate:   targetDate ? new Date(targetDate).toISOString() : undefined,
      });
      if (!r.ok) { setError(r.error ?? "Could not create make job"); return; }
      router.push(`/make/${r.data!.id}`);
    });
  }

  return (
    <div className="rounded-[14px] bg-surface border border-rule p-6">
      <form onSubmit={onSubmit} className="space-y-5">

        <div>
          <label className="block text-[10.5px] uppercase tracking-[0.12em] text-text-dim mb-1.5">
            Sales order <span className="text-bad">*</span>
          </label>
          <select
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            required
            className="w-full h-[36px] px-3 bg-surface-2 border border-rule rounded-[8px] text-[13px] outline-none focus:border-accent"
          >
            <option value="">— pick an order —</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10.5px] uppercase tracking-[0.12em] text-text-dim mb-1.5">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full h-[36px] px-3 bg-surface-2 border border-rule rounded-[8px] text-[13px] outline-none focus:border-accent"
            >
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10.5px] uppercase tracking-[0.12em] text-text-dim mb-1.5">
              Target date
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full h-[36px] px-3 bg-surface-2 border border-rule rounded-[8px] text-[13px] tabular outline-none focus:border-accent"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10.5px] uppercase tracking-[0.12em] text-text-dim mb-1.5">
            Tailor / vendor (optional)
          </label>
          <select
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            className="w-full h-[36px] px-3 bg-surface-2 border border-rule rounded-[8px] text-[13px] outline-none focus:border-accent"
          >
            <option value="">— in-house —</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10.5px] uppercase tracking-[0.12em] text-text-dim mb-1.5">
            Assigned to (optional)
          </label>
          <select
            value={assignedToId}
            onChange={(e) => setAssigned(e.target.value)}
            className="w-full h-[36px] px-3 bg-surface-2 border border-rule rounded-[8px] text-[13px] outline-none focus:border-accent"
          >
            <option value="">— unassigned —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        {error && (
          <div className="rounded-[8px] bg-bad/8 border border-bad/20 px-3 py-2 text-[11.5px] text-bad">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={pending}
            className="h-[36px] px-5 rounded-[8px] bg-accent text-white text-[13px] font-medium hover:bg-accent/90 transition-colors disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create make job"}
          </button>
          <a
            href="/make"
            className="h-[36px] px-4 rounded-[8px] bg-surface border border-rule text-[13px] text-text-dim hover:text-text transition-colors inline-flex items-center"
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}
