"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createLeadSchema, LEAD_SOURCES, type CreateLeadInput,
} from "@/modules/leads/schema";
import { createLead, updateLead } from "@/modules/leads/actions";
import type { BranchOption } from "@/modules/branches/queries";

interface LeadFormProps {
  mode: "create" | "edit";
  branches: BranchOption[];
  initial?: Partial<CreateLeadInput> & { id?: string };
}

const SOURCE_LABEL: Record<string, string> = {
  WEBSITE: "Website", REFERRAL: "Referral", WHATSAPP: "WhatsApp",
  WALK_IN: "Walk-in", EXHIBITION: "Exhibition", COLD_CALL: "Cold call", OTHER: "Other",
};

export function LeadForm({ mode, branches, initial }: LeadFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register, handleSubmit, formState: { errors }, setError,
  } = useForm<CreateLeadInput>({
    resolver: zodResolver(createLeadSchema),
    defaultValues: {
      name: initial?.name ?? "",
      mobile: initial?.mobile ?? "",
      email: initial?.email ?? "",
      companyName: initial?.companyName ?? "",
      source: initial?.source ?? "REFERRAL",
      requirement: initial?.requirement ?? "",
      expectedValue: initial?.expectedValue ?? "",
      branchId: initial?.branchId ?? branches[0]?.id ?? "",
    },
  });

  function onSubmit(values: CreateLeadInput) {
    setServerError(null);
    startTransition(async () => {
      const payload = mode === "edit" && initial?.id
        ? { ...values, id: initial.id }
        : values;
      const result = mode === "edit"
        ? await updateLead(payload)
        : await createLead(payload);
      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [k, msg] of Object.entries(result.fieldErrors)) {
            setError(k as keyof CreateLeadInput, { message: msg });
          }
        }
        setServerError(result.error ?? "Something went wrong");
        return;
      }
      const targetId = mode === "create" ? result.data?.id : initial?.id;
      const target = (targetId ? `/leads/${targetId}` : "/leads") as Route;
      router.push(mode === "edit" ? ("/leads" as Route) : target);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-[14px] bg-surface border border-rule p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
        <Field label="Full name" error={errors.name?.message} required>
          <input {...register("name")} className={fieldCls} autoFocus />
        </Field>
        <Field label="Mobile" error={errors.mobile?.message} required hint="10 digits or +91-prefixed">
          <input {...register("mobile")} className={`${fieldCls} tabular`} inputMode="tel" />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <input {...register("email")} className={fieldCls} type="email" />
        </Field>
        <Field label="Company" error={errors.companyName?.message}>
          <input {...register("companyName")} className={fieldCls} />
        </Field>
        <Field label="Source" error={errors.source?.message} required>
          <select {...register("source")} className={fieldCls}>
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>{SOURCE_LABEL[s] ?? s}</option>
            ))}
          </select>
        </Field>
        {branches.length > 1 ? (
          <Field label="Branch" error={errors.branchId?.message} required>
            <select {...register("branchId")} className={fieldCls}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </Field>
        ) : (
          <input type="hidden" {...register("branchId")} />
        )}
        <Field label="Expected value" error={errors.expectedValue?.message} hint="e.g. 250000, 2.5L, 25 lakh">
          <input {...register("expectedValue")} className={`${fieldCls} tabular`} inputMode="decimal" />
        </Field>
        <div />
        <Field label="Requirement" error={errors.requirement?.message} span={2}>
          <textarea {...register("requirement")} rows={3} className={`${fieldCls} resize-y`} />
        </Field>
      </div>

      {serverError && (
        <div className="mt-4 text-[12px] text-bad">{serverError}</div>
      )}

      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="h-[36px] px-4 rounded-[8px] text-[12.5px] text-text-dim hover:text-text hover:bg-surface-hover transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="h-[36px] px-5 rounded-[8px] bg-accent text-white text-[12.5px] font-medium hover:bg-accent-hover disabled:opacity-60 transition-colors"
        >
          {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Create lead"}
        </button>
      </div>
    </form>
  );
}

const fieldCls =
  "w-full h-[34px] px-3 bg-white/60 border border-rule rounded-[6px] text-[12.5px] outline-none focus:border-accent transition-colors";

function Field({
  label, error, required, hint, span = 1, children,
}: {
  label: string; error?: string; required?: boolean; hint?: string; span?: 1 | 2;
  children: React.ReactNode;
}) {
  return (
    <div className={span === 2 ? "lg:col-span-2" : undefined}>
      <div className="mb-1 text-[11px] tracking-[0.06em] uppercase text-text-dim">
        {label}{required && <span className="text-accent"> *</span>}
      </div>
      {children}
      <div className="mt-1 min-h-[14px] text-[11px]">
        {error
          ? <span className="text-bad">{error}</span>
          : hint ? <span className="text-text-faint">{hint}</span> : null}
      </div>
    </div>
  );
}
