"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createUser } from "@/modules/admin/actions";

interface Props {
  roles: { id: string; name: string }[];
  branches: { id: string; name: string }[];
}

export function AddUserForm({ roles, branches }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState<string>(roles[0]?.id ?? "");
  const [branchIds, setBranchIds] = useState<string[]>(branches.map((b) => b.id));
  const [error, setError] = useState<string | null>(null);

  function toggleBranch(id: string) {
    setBranchIds((xs) => xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]);
  }

  function commit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createUser({ name, mobile, email, roleId, branchIds });
      if (!res.ok) { setError(res.error ?? "Could not add user"); return; }
      setName(""); setMobile(""); setEmail(""); setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
              disabled={roles.length === 0 || branches.length === 0}
              className="inline-flex items-center gap-1.5 h-[30px] px-3 rounded-[6px] text-[11.5px] font-medium bg-accent text-white hover:bg-accent-hover disabled:opacity-40 transition-colors">
        <Plus size={12} /> Add user
      </button>
    );
  }

  return (
    <form onSubmit={commit} className="mt-4 pt-4 border-t border-rule grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label="Name" required>
        <input value={name} onChange={(e) => setName(e.target.value)} className={fieldCls} autoFocus />
      </Field>
      <Field label="Mobile" required hint="10 digits or +91-prefixed">
        <input value={mobile} onChange={(e) => setMobile(e.target.value)} inputMode="tel" className={`${fieldCls} tabular`} />
      </Field>
      <Field label="Email">
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={fieldCls} />
      </Field>
      <Field label="Role" required>
        <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className={fieldCls}>
          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </Field>
      <div className="sm:col-span-2">
        <div className="mb-1 text-[11px] uppercase tracking-[0.06em] text-text-dim">Branches</div>
        <div className="flex flex-wrap gap-2">
          {branches.map((b) => (
            <label key={b.id} className="inline-flex items-center gap-1.5 text-[12px] text-text">
              <input type="checkbox" checked={branchIds.includes(b.id)} onChange={() => toggleBranch(b.id)}
                     className="accent-accent" />
              {b.name}
            </label>
          ))}
        </div>
      </div>
      {error && <div className="sm:col-span-2 text-[11.5px] text-bad">{error}</div>}
      <div className="sm:col-span-2 flex items-center justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="h-[30px] px-3 text-[11.5px] text-text-dim">Cancel</button>
        <button type="submit" disabled={pending || !name || !mobile || !roleId || branchIds.length === 0}
                className="h-[30px] px-3 rounded-[6px] bg-accent text-white text-[11.5px] font-medium disabled:opacity-40">
          {pending ? "Creating…" : "Create user"}
        </button>
      </div>
    </form>
  );
}

const fieldCls = "w-full h-[32px] px-2 bg-white/60 border border-rule rounded-[6px] text-[12.5px] outline-none focus:border-accent";
function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] uppercase tracking-[0.06em] text-text-dim">
        {label}{required && <span className="text-accent"> *</span>}
      </div>
      {children}
      {hint && <div className="mt-0.5 text-[10.5px] text-text-faint">{hint}</div>}
    </label>
  );
}
