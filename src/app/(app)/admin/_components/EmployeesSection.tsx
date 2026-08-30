"use client";

// Employees section for the Admin page. Owner adds/removes people.
// Delete is protected: employees with attendance/payroll/leave history
// can only be Terminated (soft-delete) — HR records must persist.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { Plus, Trash2, Archive, ChevronRight, KeyRound } from "lucide-react";
import { deleteEmployee, setEmployeeStatus } from "@/modules/employees/actions";
import { setEmployeeLogin } from "@/modules/employees/actions-login";
import type { EmployeeRow } from "@/modules/employees/queries";
import { iso, statusLabel, Th, Td } from "./_employee-fields";
import { EmployeeAddForm } from "./EmployeeAddForm";

interface Props {
  employees: EmployeeRow[];
  branches: { id: string; name: string }[];
  roles: { id: string; name: string }[];
  activeCount: number;
  totalCount: number;
}

const STATUS_TONE: Record<string, string> = {
  ACTIVE:     "bg-good/12 text-good",
  ON_LEAVE:   "bg-warn/15 text-warn",
  RESIGNED:   "bg-text-dim/12 text-text-dim",
  TERMINATED: "bg-bad/12 text-bad",
};

export function EmployeesSection({ employees, branches, roles, activeCount, totalCount }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  // Password reset, one row at a time (owner, 2026-08-29). Nothing here
  // can read an existing password — bcrypt is one-way — so this sets a
  // new one for the owner to pass on.
  const [pwFor,  setPwFor]  = useState<string | null>(null);
  const [pwText, setPwText] = useState("");
  const [pwEmail, setPwEmail] = useState("");
  const [pwRole,  setPwRole]  = useState("");
  const [pwDone, setPwDone] = useState<string | null>(null);

  function commitPassword(id: string) {
    setRowError((e) => ({ ...e, [id]: "" }));
    setPwDone(null);
    startTransition(async () => {
      const res = await setEmployeeLogin({
        employeeId: id, email: pwEmail, password: pwText, roleId: pwRole,
      });
      if (!res.ok) {
        setRowError((e) => ({ ...e, [id]: res.error ?? "Could not set the password" }));
        return;
      }
      setPwFor(null); setPwText(""); setPwEmail(""); setPwRole(""); setPwDone(id);
      router.refresh();
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
        <EmployeeAddForm
          branches={branches}
          roles={roles}
          onDone={() => setAddOpen(false)}
        />
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
                      {/* One control for the whole sign-in, because the two
                          halves are useless apart: this used to set a password
                          only, and refused for anyone with no account at all —
                          telling the owner it was broken without offering the
                          fix. It now sets the login address too, and creates
                          the account when there isn't one. */}
                      <button
                        type="button"
                        onClick={() => {
                          setPwFor(pwFor === emp.id ? null : emp.id);
                          setPwText(""); setPwEmail(emp.email ?? ""); setPwRole("");
                          setPwDone(null);
                        }}
                        title={emp.hasLogin ? "Change their email or password" : "Give this person a login"}
                        className="inline-flex h-[24px] items-center gap-1 rounded-[4px] border border-rule px-2 text-[10.5px] text-text-dim transition-colors hover:border-accent/50 hover:text-accent"
                      >
                        <KeyRound size={11} /> {emp.hasLogin ? "Login" : "Give login"}
                      </button>
                    </div>

                    {pwFor === emp.id && (
                      <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5">
                        {!emp.hasLogin && (
                          <select
                            value={pwRole}
                            onChange={(e) => setPwRole(e.target.value)}
                            className="h-[28px] w-[150px] rounded-[6px] border border-rule bg-white/60 px-2 text-[12px] outline-none focus:border-accent"
                          >
                            <option value="">Pick a role…</option>
                            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </select>
                        )}
                        <input
                          type="email"
                          value={pwEmail}
                          onChange={(e) => setPwEmail(e.target.value)}
                          placeholder="Email for signing in"
                          className="h-[28px] w-[190px] rounded-[6px] border border-rule bg-white/60 px-2 text-[12px] outline-none focus:border-accent"
                        />
                        <input
                          type="text"
                          value={pwText}
                          onChange={(e) => setPwText(e.target.value)}
                          placeholder={emp.hasLogin ? "New password (optional)" : "First password (min 8)"}
                          className="h-[28px] w-[190px] rounded-[6px] border border-rule bg-white/60 px-2 text-[12px] outline-none focus:border-accent"
                        />
                        <button
                          type="button"
                          onClick={() => commitPassword(emp.id)}
                          disabled={
                            pending ||
                            (emp.hasLogin
                              ? !pwEmail && pwText.length < 8
                              : !pwRole || pwText.length < 8)
                          }
                          className="h-[28px] rounded-[6px] bg-accent px-3 text-[11.5px] font-medium text-white disabled:opacity-40"
                        >
                          Save
                        </button>
                        <div className="w-full text-right text-[10px] text-text-faint">
                          They can sign in with this email, their mobile, or code {emp.code}.
                        </div>
                      </div>
                    )}
                    {pwDone === emp.id && (
                      <div className="mt-1 text-[10.5px] text-good">
                        Sign-in updated — tell {emp.name} their new details.
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
