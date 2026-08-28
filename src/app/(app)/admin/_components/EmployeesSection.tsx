"use client";

// Employees section for the Admin page. Owner adds/removes people.
// Delete is protected: employees with attendance/payroll/leave history
// can only be Terminated (soft-delete) — HR records must persist.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { Plus, Trash2, Archive, ChevronRight, KeyRound } from "lucide-react";
import { createEmployee, deleteEmployee, setEmployeeStatus } from "@/modules/employees/actions";
import { setEmployeePassword } from "@/modules/employees/actions-password";
import type { EmployeeRow } from "@/modules/employees/queries";
import { fieldCls, iso, statusLabel, Field, Th, Td } from "./_employee-fields";

interface Props {
  employees: EmployeeRow[];
  branches: { id: string; name: string }[];
  activeCount: number;
  totalCount: number;
}

const STATUS_TONE: Record<string, string> = {
  ACTIVE:     "bg-good/12 text-good",
  ON_LEAVE:   "bg-warn/15 text-warn",
  RESIGNED:   "bg-text-dim/12 text-text-dim",
  TERMINATED: "bg-bad/12 text-bad",
};

export function EmployeesSection({ employees, branches, activeCount, totalCount }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  // add-form state
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [designation, setDesignation] = useState("");
  const [department, setDepartment] = useState("");
  const [branchId, setBranchId] = useState<string>(branches[0]?.id ?? "");
  const [joinDate, setJoinDate] = useState<string>(iso(new Date()));
  const [code, setCode] = useState("");

  // Password reset, one row at a time (owner, 2026-08-29). Nothing here
  // can read an existing password — bcrypt is one-way — so this sets a
  // new one for the owner to pass on.
  const [pwFor,  setPwFor]  = useState<string | null>(null);
  const [pwText, setPwText] = useState("");
  const [pwDone, setPwDone] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function commitAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    startTransition(async () => {
      const res = await createEmployee({
        name, mobile, designation, department,
        branchId, joinDate, code,
      });
      if (!res.ok) { setFormError(res.error ?? "Could not add employee"); return; }
      setName(""); setMobile(""); setDesignation("");
      setDepartment(""); setCode(""); setAddOpen(false);
      router.refresh();
    });
  }

  function commitPassword(id: string) {
    setRowError((e) => ({ ...e, [id]: "" }));
    setPwDone(null);
    startTransition(async () => {
      const res = await setEmployeePassword({ employeeId: id, password: pwText });
      if (!res.ok) {
        setRowError((e) => ({ ...e, [id]: res.error ?? "Could not set the password" }));
        return;
      }
      setPwFor(null); setPwText(""); setPwDone(id);
    });
  }

  function commitDelete(id: string) {
    setRowError((e) => ({ ...e, [id]: "" }));
    startTransition(async () => {
      const res = await deleteEmployee({ id });
      if (!res.ok) {
        setRowError((e) => ({ ...e, [id]: res.error ?? "Could not delete" }));
        return;
      }
      router.refresh();
    });
  }

  function commitTerminate(id: string) {
    setRowError((e) => ({ ...e, [id]: "" }));
    startTransition(async () => {
      const res = await setEmployeeStatus({ id, status: "TERMINATED", exitDate: iso(new Date()) });
      if (!res.ok) {
        setRowError((e) => ({ ...e, [id]: res.error ?? "Could not terminate" }));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-[14px] bg-surface border border-rule p-5 sm:p-6">
      <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
        <div>
          <div className="font-display text-[18px] font-semibold">Employees</div>
          <div className="text-[11.5px] text-text-dim mt-0.5">
            {activeCount} active · {totalCount} total on record
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(!addOpen)}
          disabled={branches.length === 0}
          className="inline-flex items-center gap-1.5 h-[30px] px-3 rounded-[6px] text-[11.5px] font-medium bg-accent text-white hover:bg-accent-hover disabled:opacity-40 transition-colors"
        >
          <Plus size={12} /> Add employee
        </button>
      </div>

      {addOpen && (
        <form onSubmit={commitAdd} className="mb-4 pb-4 border-b border-rule grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
          <Field label="Department">
            <input value={department} onChange={(e) => setDepartment(e.target.value)}
                   placeholder="e.g. Projects" className={fieldCls} />
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
          <div className="lg:col-span-3 flex items-center justify-end gap-2">
            {formError && <div className="text-[11.5px] text-bad mr-auto">{formError}</div>}
            <button type="button" onClick={() => setAddOpen(false)}
                    className="h-[30px] px-3 text-[11.5px] text-text-dim hover:text-text">Cancel</button>
            <button type="submit" disabled={pending || !name || !mobile || !branchId}
                    className="h-[30px] px-3 rounded-[6px] bg-accent text-white text-[11.5px] font-medium disabled:opacity-40">
              {pending ? "Adding…" : "Add employee"}
            </button>
          </div>
        </form>
      )}

      {employees.length === 0 ? (
        <div className="py-8 text-center text-[12px] text-text-faint">
          No employees on the roster yet. Click <b>Add employee</b> to enter your first team member.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                <Th>Code</Th>
                <Th>Name</Th>
                <Th>Designation</Th>
                <Th>Branch</Th>
                <Th>Mobile</Th>
                <Th>Status</Th>
                <Th align="right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="border-b border-rule/60 last:border-0 align-top">
                  <Td className="tabular text-text-dim">{emp.code}</Td>
                  <Td>
                    <div className="text-text">{emp.name}</div>
                    {emp.email && <div className="text-[10.5px] text-text-faint tabular">{emp.email}</div>}
                  </Td>
                  <Td className="text-text-dim">
                    {emp.designation ?? "—"}
                    {emp.department && <div className="text-[10.5px] text-text-faint">{emp.department}</div>}
                  </Td>
                  <Td className="text-text-dim">{emp.branchName}</Td>
                  <Td className="tabular">{emp.mobile}</Td>
                  <Td>
                    <span className={`inline-block text-[10.5px] font-medium tracking-[0.06em] uppercase px-2 py-0.5 rounded-[3px] ${STATUS_TONE[emp.status] ?? "bg-text-dim/12 text-text-dim"}`}>
                      {statusLabel(emp.status)}
                    </span>
                  </Td>
                  <Td align="right">
                    <div className="inline-flex items-center gap-1">
                      <Link
                        href={`/admin/employees/${emp.id}` as Route}
                        title="View employee + assign tasks"
                        className="inline-flex items-center gap-1 h-[24px] px-2 rounded-[4px] text-[10.5px] text-text-dim border border-rule hover:text-accent hover:border-accent/50 transition-colors"
                      >
                        View <ChevronRight size={10} strokeWidth={2} />
                      </Link>
                      {emp.status === "ACTIVE" || emp.status === "ON_LEAVE" ? (
                        emp.hasAttendance || emp.hasPayslip ? (
                          <button type="button" onClick={() => commitTerminate(emp.id)} disabled={pending}
                                  title="Terminate (soft-archive — keeps payroll history)"
                                  className="inline-flex items-center gap-1 h-[24px] px-2 rounded-[4px] text-[10.5px] bg-warn/15 text-warn hover:bg-warn/25 transition-colors">
                            <Archive size={11} /> Terminate
                          </button>
                        ) : (
                          <button type="button" onClick={() => commitDelete(emp.id)} disabled={pending}
                                  title="Delete (no history yet, hard delete)"
                                  className="inline-flex items-center gap-1 h-[24px] px-2 rounded-[4px] text-[10.5px] bg-bad/12 text-bad hover:bg-bad/20 transition-colors">
                            <Trash2 size={11} /> Delete
                          </button>
                        )
                      ) : (
                        <span className="text-[10.5px] text-text-faint">archived</span>
                      )}
                      <button
                        type="button"
                        onClick={() => { setPwFor(pwFor === emp.id ? null : emp.id); setPwText(""); setPwDone(null); }}
                        title="Set a new login password"
                        className="inline-flex h-[24px] items-center gap-1 rounded-[4px] border border-rule px-2 text-[10.5px] text-text-dim transition-colors hover:border-accent/50 hover:text-accent"
                      >
                        <KeyRound size={11} /> Password
                      </button>
                    </div>

                    {pwFor === emp.id && (
                      <div className="mt-2 flex items-center justify-end gap-1.5">
                        <input
                          type="password"
                          value={pwText}
                          onChange={(e) => setPwText(e.target.value)}
                          placeholder="New password (min 8)"
                          className="h-[28px] w-[190px] rounded-[6px] border border-rule bg-white/60 px-2 text-[12px] outline-none focus:border-accent"
                        />
                        <button
                          type="button"
                          onClick={() => commitPassword(emp.id)}
                          disabled={pending || pwText.length < 8}
                          className="h-[28px] rounded-[6px] bg-accent px-3 text-[11.5px] font-medium text-white disabled:opacity-40"
                        >
                          Save
                        </button>
                      </div>
                    )}
                    {pwDone === emp.id && (
                      <div className="mt-1 text-[10.5px] text-good">
                        Password updated — tell {emp.name} their new password.
                      </div>
                    )}
                    {rowError[emp.id] && (
                      <div className="mt-1 text-[10.5px] text-bad max-w-[220px] text-right">
                        {rowError[emp.id]}
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
