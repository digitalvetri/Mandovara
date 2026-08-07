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
import { EntityForm } from "@/components/data/EntityForm";

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
      name:          initial?.name          ?? "",
      mobile:        initial?.mobile        ?? "",
      email:         initial?.email         ?? "",
      companyName:   initial?.companyName   ?? "",
      source:        initial?.source        ?? "REFERRAL",
      requirement:   initial?.requirement   ?? "",
      expectedValue: initial?.expectedValue ?? "",
      branchId:      initial?.branchId      ?? branches[0]?.id ?? "",
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
    <EntityForm
      onSubmit={handleSubmit(onSubmit)}
      pending={pending}
      serverError={serverError}
      submitLabel={mode === "edit" ? "Save changes" : "Create lead"}
      onCancel={() => router.back()}
    >
      <EntityForm.Field label="Full name" error={errors.name?.message} required>
        <input {...register("name")} className={EntityForm.fieldCls} autoFocus />
      </EntityForm.Field>

      <EntityForm.Field label="Mobile" error={errors.mobile?.message} required hint="10 digits or +91-prefixed">
        <input {...register("mobile")} className={`${EntityForm.fieldCls} tabular`} inputMode="tel" />
      </EntityForm.Field>

      <EntityForm.Field label="Email" error={errors.email?.message}>
        <input {...register("email")} className={EntityForm.fieldCls} type="email" />
      </EntityForm.Field>

      <EntityForm.Field label="Company" error={errors.companyName?.message}>
        <input {...register("companyName")} className={EntityForm.fieldCls} />
      </EntityForm.Field>

      <EntityForm.Field label="Source" error={errors.source?.message} required>
        <select {...register("source")} className={EntityForm.fieldCls}>
          {LEAD_SOURCES.map((s) => (
            <option key={s} value={s}>{SOURCE_LABEL[s] ?? s}</option>
          ))}
        </select>
      </EntityForm.Field>

      {branches.length > 1 ? (
        <EntityForm.Field label="Branch" error={errors.branchId?.message} required>
          <select {...register("branchId")} className={EntityForm.fieldCls}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </EntityForm.Field>
      ) : (
        <input type="hidden" {...register("branchId")} />
      )}

      <EntityForm.Field label="Expected value" error={errors.expectedValue?.message} hint="e.g. 250000, 2.5L, 25 lakh">
        <input {...register("expectedValue")} className={`${EntityForm.fieldCls} tabular`} inputMode="decimal" />
      </EntityForm.Field>

      {/* Spacer so the textarea aligns properly on the second row */}
      <div />

      <EntityForm.Field label="Requirement" error={errors.requirement?.message} span={2}>
        <textarea {...register("requirement")} rows={3} className={`${EntityForm.fieldCls} resize-y`} />
      </EntityForm.Field>
    </EntityForm>
  );
}
