"use client";

// Adding a person: their staff record and, optionally, their login.
//
// Split out of EmployeesSection when the old "Login accounts" card was
// merged in here (owner, 2026-08-30: "remove the Login Accounts or we can
// merge that Employee with that") and the section went past §10's 300-line
// ceiling. It owns its own form state, which is the whole reason it comes
// out cleanly — nothing above it needs to know what is half-typed.
//
// One submit writes both rows in one transaction. Leaving the role blank
// creates a roster-only person: on payroll and attendance, no sign-in.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createEmployee } from "@/modules/employees/actions";
import { EMPLOYEE_TEAMS } from "@/modules/employees/teams";
import { fieldCls, iso, Field } from "./_employee-fields";

interface Props {
  branches: { id: string; name: string }[];
  roles:    { id: string; name: string }[];
  onDone:   () => void;
}

export function EmployeeAddForm({ branches, roles, onDone }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName]               = useState("");
  const [mobile, setMobile]           = useState("");
  const [designation, setDesignation] = useState("");
  const [department, setDepartment]   = useState("");
  const [branchId, setBranchId]       = useState<string>(branches[0]?.id ?? "");
  const [joinDate, setJoinDate]       = useState<string>(iso(new Date()));
  const [code, setCode]               = useState("");
  // Login fields — merged in from the old separate "Login accounts" card.
  const [roleId, setRoleId]           = useState("");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [formError, setFormError]     = useState<string | null>(null);

  function commit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    startTransition(async () => {
      const res = await createEmployee({
        name, mobile, designation, department,
        branchId, joinDate, code,
        roleId, email, password,
      });
      if (!res.ok) { setFormError(res.error ?? "Could not add employee"); return; }
      setName(""); setMobile(""); setDesignation("");
      setDepartment(""); setCode("");
      setRoleId(""); setEmail(""); setPassword("");
      onDone();
      router.refresh();
    });
  }

  return (
    <form onSubmit={commit} className="mb-4 pb-4 border-b border-rule grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <Field label="Full name" required>
        <input value={name} onChange={(e) => setName(e.target.value)} className={fieldCls} autoFocus />
      </Field>
      <Field label="Mobile" required hint="10 digits or +91-prefixed">
        <input value={mobile} onChange={(e) => setMobile(e.target.value)} inputMode="tel" className={`${fieldCls} tabular`} />
      </Field>
      <Field label="Code" hint="Leave blank to auto-generate (EMP0001)">
        <input value={code} onChange={(e) => setCode(e.target.value)} className={`${fieldCls} tabular uppercase`} />
      </Field>
      <Field label="Designation">
        <input value={designation} onChange={(e) => setDesignation(e.target.value)}
               placeholder="e.g. Site Engineer" className={fieldCls} />
      </Field>
      {/* One of the three teams rather than free text — the same
          team typed three ways stops grouping in exports. */}
      <Field label="Team">
        <select value={department} onChange={(e) => setDepartment(e.target.value)} className={fieldCls}>
          <option value="">Select a team…</option>
          {EMPLOYEE_TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Branch" required>
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={fieldCls}>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </Field>
      <Field label="Join date" required>
        <input type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)}
               className={`${fieldCls} tabular`} />
      </Field>

      {/* Sign-in lives in the same form as the staff record, so a person
          cannot be created into the half-state the two separate forms
          used to produce: on the roster but unable to log in, or able to
          log in but absent from payroll. */}
      <div className="lg:col-span-3 mt-1 border-t border-rule/60 pt-3">
        <div className="text-[11.5px] font-medium text-text">Sign-in access</div>
        <p className="mt-0.5 text-[11px] text-text-dim">
          Pick a role to give this person a login. They can sign in with their
          email, their mobile, or their employee code. Leave the role blank for
          roster-only staff.
        </p>
      </div>
      <Field label="Role" hint="Blank = no sign-in">
        <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className={fieldCls}>
          <option value="">No login</option>
          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </Field>
      <Field label="Email" hint="Optional — they can use their code instead">
        <input value={email} onChange={(e) => setEmail(e.target.value)}
               type="email" placeholder="name@example.com" className={fieldCls}
               disabled={!roleId} />
      </Field>
      <Field label="Password" hint="At least 8 characters">
        <input value={password} onChange={(e) => setPassword(e.target.value)}
               type="text" placeholder="Set their first password" className={fieldCls}
               disabled={!roleId} />
      </Field>

      <div className="lg:col-span-3 flex items-center justify-end gap-2">
        {formError && <div className="text-[11.5px] text-bad mr-auto">{formError}</div>}
        <button type="button" onClick={onDone}
                className="h-[30px] px-3 text-[11.5px] text-text-dim hover:text-text">Cancel</button>
        <button type="submit" disabled={pending || !name || !mobile || !branchId}
                className="h-[30px] px-3 rounded-[6px] bg-accent text-white text-[11.5px] font-medium disabled:opacity-40">
          {pending ? "Adding…" : "Add employee"}
        </button>
      </div>
    </form>
  );
}
