"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createLeadSchema,
  LEAD_SOURCE_OPTIONS,
  PROJECT_TYPES,
  BUDGET_RANGES,
  type CreateLeadInput,
} from "@/modules/leads/schema";
import { createLead, updateLead } from "@/modules/leads/actions";
import type { BranchOption } from "@/modules/branches/queries";
import type { SalesUserOption } from "@/modules/leads/queries";
import { EntityForm } from "@/components/data/EntityForm";

interface LeadFormProps {
  mode: "create" | "edit";
  branches: BranchOption[];
  salesUsers: SalesUserOption[];
  initial?: Partial<CreateLeadInput> & { id?: string };
}

export function LeadForm({ mode, branches, salesUsers, initial }: LeadFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register, handleSubmit, formState: { errors }, setError,
  } = useForm<CreateLeadInput>({
    resolver: zodResolver(createLeadSchema),
    defaultValues: {
      name:        initial?.name        ?? "",
      mobile:      initial?.mobile      ?? "",
      altMobile:   initial?.altMobile   ?? "",
      email:       initial?.email       ?? "",
      city:        initial?.city        ?? "",
      pincode:     initial?.pincode     ?? "",
      siteAddress: initial?.siteAddress ?? "",
      projectName: initial?.projectName ?? "",
      projectType: initial?.projectType ?? undefined,
      budgetRange: initial?.budgetRange ?? "",
      source:      initial?.source      ?? "WALK_IN",
      ownerId:     initial?.ownerId     ?? "",
      requirement: initial?.requirement ?? "",
      branchId:    initial?.branchId    ?? branches[0]?.id ?? "",
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

  const fc = EntityForm.fieldCls;

  return (
    <EntityForm
      onSubmit={handleSubmit(onSubmit)}
      pending={pending}
      serverError={serverError}
      submitLabel={mode === "edit" ? "Save changes" : "Create lead"}
      onCancel={() => router.back()}
    >
      {/* ── Contact ──────────────────────────────────────────── */}
      <EntityForm.Field label="Customer Name" error={errors.name?.message} required>
        <input {...register("name")} className={fc} autoFocus placeholder="Full name" />
      </EntityForm.Field>

      <EntityForm.Field label="Mobile Number" error={errors.mobile?.message} required
        hint="10 digits or +91-prefixed">
        <input {...register("mobile")} className={`${fc} tabular-nums`} inputMode="tel"
          placeholder="9876543210" />
      </EntityForm.Field>

      <EntityForm.Field label="Alternate Mobile Number" error={errors.altMobile?.message}
        hint="10 digits or +91-prefixed">
        <input {...register("altMobile")} className={`${fc} tabular-nums`} inputMode="tel"
          placeholder="Optional" />
      </EntityForm.Field>

      <EntityForm.Field label="Email Address" error={errors.email?.message}>
        <input {...register("email")} className={fc} type="email" placeholder="Optional" />
      </EntityForm.Field>

      {/* ── Location ─────────────────────────────────────────── */}
      <EntityForm.Field label="City" error={errors.city?.message} required>
        <input {...register("city")} className={fc} placeholder="e.g. Coimbatore" />
      </EntityForm.Field>

      <EntityForm.Field label="Pincode" error={errors.pincode?.message}
        hint="6-digit pincode">
        <input {...register("pincode")} className={`${fc} tabular-nums`} inputMode="numeric"
          maxLength={6} placeholder="Optional" />
      </EntityForm.Field>

      <EntityForm.Field label="Site Address" error={errors.siteAddress?.message} required span={2}>
        <textarea {...register("siteAddress")} rows={2}
          className={`${fc} h-auto py-2 resize-none`}
          placeholder="Flat / House No., Street, Locality…" />
      </EntityForm.Field>

      {/* ── Project ──────────────────────────────────────────── */}
      <EntityForm.Field label="Project Name" error={errors.projectName?.message} required>
        <input {...register("projectName")} className={fc}
          placeholder="e.g. Dr Kannan – Villa, Saibaba Colony" />
      </EntityForm.Field>

      <EntityForm.Field label="Project Type" error={errors.projectType?.message} required>
        <select {...register("projectType")} className={fc}>
          <option value="">Select project type</option>
          {PROJECT_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </EntityForm.Field>

      {/* ── Budget & Source ──────────────────────────────────── */}
      <EntityForm.Field label="Budget Range" error={errors.budgetRange?.message}>
        <select {...register("budgetRange")} className={fc}>
          <option value="">Select range (optional)</option>
          {BUDGET_RANGES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </EntityForm.Field>

      <EntityForm.Field label="Lead Source" error={errors.source?.message} required>
        <select {...register("source")} className={fc}>
          <option value="">Select source</option>
          {LEAD_SOURCE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </EntityForm.Field>

      {/* ── Assignment ───────────────────────────────────────── */}
      <EntityForm.Field label="Assigned Sales Executive" error={errors.ownerId?.message} required span={2}>
        <select {...register("ownerId")} className={fc}>
          <option value="">Select sales executive</option>
          {salesUsers.length > 0 ? (
            salesUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))
          ) : (
            <option disabled value="">No users available (DB offline)</option>
          )}
        </select>
      </EntityForm.Field>

      {/* Hidden branch */}
      {branches.length > 1 ? (
        <EntityForm.Field label="Branch" error={errors.branchId?.message} required span={2}>
          <select {...register("branchId")} className={fc}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </EntityForm.Field>
      ) : (
        <input type="hidden" {...register("branchId")} />
      )}

      {/* ── Requirements ─────────────────────────────────────── */}
      <EntityForm.Field label="Requirements" error={errors.requirement?.message} required span={2}>
        <textarea {...register("requirement")} rows={4}
          className={`${fc} h-auto py-2 resize-y`}
          placeholder="Describe the customer's interior requirements in detail…" />
      </EntityForm.Field>
    </EntityForm>
  );
}
