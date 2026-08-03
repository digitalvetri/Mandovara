"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createProjectSchema, type CreateProjectInput } from "@/modules/projects/schema";
import { createProject } from "@/modules/projects/actions";
import type { ClientPickerRow } from "@/modules/projects/queries";
import type { BranchOption } from "@/modules/branches/queries";

interface Props {
  clients: ClientPickerRow[];
  branches: BranchOption[];
}

export function ProjectForm({ clients, branches }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const today = new Date();
  const later = new Date(); later.setDate(today.getDate() + 60);

  const {
    register, handleSubmit, formState: { errors }, setError,
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: "", clientId: "", branchId: branches[0]?.id ?? "",
      startDate: iso(today), targetEndDate: iso(later),
      orderValue: "",
    },
  });

  function onSubmit(values: CreateProjectInput) {
    setServerError(null);
    startTransition(async () => {
      const res = await createProject(values);
      if (!res.ok) {
        if (res.fieldErrors) {
          for (const [k, msg] of Object.entries(res.fieldErrors)) {
            setError(k as keyof CreateProjectInput, { message: msg });
          }
        }
        setServerError(res.error ?? "Something went wrong");
        return;
      }
      router.push(`/projects/${res.data!.id}` as Route);
      router.refresh();
    });
  }

  if (clients.length === 0) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule py-14 text-center">
        <div className="text-[14px] text-text mb-2">Add a client first.</div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-[14px] bg-surface border border-rule p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
        <Field label="Project name" error={errors.name?.message} required>
          <input {...register("name")} className={fieldCls} autoFocus placeholder="e.g. Sunrise Cafe — full interior" />
        </Field>
        <Field label="Client" error={errors.clientId?.message} required>
          <select {...register("clientId")} className={fieldCls}>
            <option value="">— pick a client —</option>
            {clients.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        </Field>
        <Field label="Branch" error={errors.branchId?.message} required>
          <select {...register("branchId")} className={fieldCls}>
            {branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
          </select>
        </Field>
        <Field label="Order value" error={errors.orderValue?.message} required hint="e.g. 500000 or 5L">
          <input {...register("orderValue")} inputMode="decimal" className={`${fieldCls} tabular`} />
        </Field>
        <Field label="Start date" error={errors.startDate?.message} required>
          <input {...register("startDate")} type="date" className={`${fieldCls} tabular`} />
        </Field>
        <Field label="Target end date" error={errors.targetEndDate?.message}>
          <input {...register("targetEndDate")} type="date" className={`${fieldCls} tabular`} />
        </Field>
      </div>

      {serverError && <div className="mt-4 text-[12px] text-bad">{serverError}</div>}

      <div className="mt-6 flex items-center justify-end gap-3">
        <button type="button" onClick={() => router.back()}
                className="h-[36px] px-4 rounded-[8px] text-[12.5px] text-text-dim hover:text-text hover:bg-surface-hover transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={pending}
                className="h-[36px] px-5 rounded-[8px] bg-accent text-white text-[12.5px] font-medium hover:bg-accent-hover disabled:opacity-60 transition-colors">
          {pending ? "Creating…" : "Create project"}
        </button>
      </div>
    </form>
  );
}

const fieldCls =
  "w-full h-[34px] px-3 bg-white/60 border border-rule rounded-[6px] text-[12.5px] outline-none focus:border-accent transition-colors";

function iso(d: Date): string { return d.toISOString().slice(0, 10); }
function Field({
  label, error, required, hint, children,
}: { label: string; error?: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] tracking-[0.06em] uppercase text-text-dim">
        {label}{required && <span className="text-accent"> *</span>}
      </div>
      {children}
      <div className="mt-1 min-h-[14px] text-[11px]">
        {error ? <span className="text-bad">{error}</span>
              : hint ? <span className="text-text-faint">{hint}</span> : null}
      </div>
    </div>
  );
}
