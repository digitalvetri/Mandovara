"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createAutomationRule } from "@/modules/whatsapp/actions";

export function AddRuleForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [eventType, setEventType] = useState("quotation.sent");
  const [action, setAction] = useState("whatsapp");
  const [error, setError] = useState<string | null>(null);

  function commit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createAutomationRule({ name, eventType, action });
      if (!res.ok) { setError(res.error ?? "Could not create rule"); return; }
      setName(""); setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1.5 h-[28px] px-3 rounded-[6px] text-[11.5px] text-accent hover:bg-accent/10 transition-colors">
        <Plus size={12} /> Add rule
      </button>
    );
  }

  return (
    <form onSubmit={commit} className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
      <div className="sm:col-span-2">
        <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Name</div>
        <input value={name} onChange={(e) => setName(e.target.value)}
               placeholder="e.g. Payment due reminder"
               className={fieldCls} />
      </div>
      <div>
        <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Fires on</div>
        <select value={eventType} onChange={(e) => setEventType(e.target.value)} className={fieldCls}>
          <option value="lead.created">lead.created</option>
          <option value="quotation.sent">quotation.sent</option>
          <option value="invoice.created">invoice.created</option>
          <option value="payment.overdue">payment.overdue</option>
        </select>
      </div>
      <div>
        <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Action</div>
        <select value={action} onChange={(e) => setAction(e.target.value)} className={fieldCls}>
          <option value="whatsapp">Send WhatsApp</option>
          <option value="task">Create task</option>
          <option value="assign">Assign to team</option>
        </select>
      </div>
      {error && <div className="sm:col-span-4 text-[11.5px] text-bad">{error}</div>}
      <div className="sm:col-span-4 flex items-center justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="h-[28px] px-3 text-[11.5px] text-text-dim">Cancel</button>
        <button type="submit" disabled={pending || !name}
                className="h-[28px] px-3 rounded-[6px] bg-accent text-white text-[11.5px] font-medium disabled:opacity-40">
          {pending ? "Saving…" : "Save rule"}
        </button>
      </div>
    </form>
  );
}
const fieldCls = "w-full h-[30px] px-2 bg-white/60 border border-rule rounded-[6px] text-[12px] outline-none focus:border-accent";
