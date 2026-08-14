"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import {
  createLeadSchema,
  LEAD_SOURCE_OPTIONS,
  LEAD_PRIORITY_OPTIONS,
  type CreateLeadInput,
} from "@/modules/leads/schema";
import { createLead } from "@/modules/leads/actions";
import type { BranchOption } from "@/modules/branches/queries";
import type { SalesUserOption } from "@/modules/leads/queries";
import { EntityForm } from "@/components/data/EntityForm";

interface LeadFormProps {
  mode: "create" | "edit";
  branches: BranchOption[];
  salesUsers: SalesUserOption[];
  initial?: Partial<CreateLeadInput> & { id?: string };
}

export function LeadForm({ branches, salesUsers }: LeadFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<CreateLeadInput>({
    resolver: zodResolver(createLeadSchema),
    defaultValues: {
      name:      "",
      mobile:    "",
      altMobile: "",
      email:     "",
      city:      "",
      pincode:   "",
      requirement: "",
      source:    undefined,
      priority:  "WARM",
      ownerId:   "",
      branchId:  branches[0]?.id ?? "",
    },
  });

  function onSubmit(values: CreateLeadInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await createLead(values);
      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [k, msg] of Object.entries(result.fieldErrors)) {
            setError(k as keyof CreateLeadInput, { message: msg });
          }
        }
        setServerError(result.error ?? "Something went wrong. Please try again.");
        return;
      }
      setIsSuccess(true);
      setTimeout(() => {
        router.push("/leads");
        router.refresh();
      }, 1400);
    });
  }

  const fc = EntityForm.fieldCls;

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: "oklch(0.78 0.145 165 / 0.15)", border: "2px solid oklch(0.78 0.145 165 / 0.4)" }}
        >
          <CheckCircle2 size={28} style={{ color: "var(--color-solid, oklch(0.78 0.145 165))" }} />
        </div>
        <div className="text-center">
          <p className="text-[16px] font-semibold text-text">Lead created successfully</p>
          <p className="text-[13px] text-text-muted mt-1">Returning to leads list…</p>
        </div>
      </div>
    );
  }

  return (
    <EntityForm
      onSubmit={handleSubmit(onSubmit)}
      pending={pending}
      serverError={serverError}
      submitLabel="Create Lead"
      onCancel={() => router.back()}
    >
      {/* ── Customer Information ────────────────────────────────── */}
      <EntityForm.Field label="Customer Name" error={errors.name?.message} required span={2}>
        <input
          {...register("name")}
          className={fc}
          autoFocus
          placeholder="Full name"
          autoComplete="name"
        />
      </EntityForm.Field>

      <EntityForm.Field label="Mobile Number" error={errors.mobile?.message} required
        hint="10 digits or +91-prefixed">
        <input
          {...register("mobile")}
          className={`${fc} tabular-nums`}
          inputMode="tel"
          placeholder="9876543210"
          autoComplete="tel"
        />
      </EntityForm.Field>

      <EntityForm.Field label="Alternate Mobile" error={errors.altMobile?.message}
        hint="10 digits or +91-prefixed">
        <input
          {...register("altMobile")}
          className={`${fc} tabular-nums`}
          inputMode="tel"
          placeholder="Optional"
        />
      </EntityForm.Field>

      <EntityForm.Field label="Email" error={errors.email?.message}>
        <input
          {...register("email")}
          className={fc}
          type="email"
          placeholder="Optional"
          autoComplete="email"
        />
      </EntityForm.Field>

      <EntityForm.Field label="City" error={errors.city?.message}>
        <input
          {...register("city")}
          className={fc}
          placeholder="e.g. Coimbatore"
          autoComplete="address-level2"
        />
      </EntityForm.Field>

      <EntityForm.Field label="Pincode" error={errors.pincode?.message} hint="6-digit">
        <input
          {...register("pincode")}
          className={`${fc} tabular-nums`}
          inputMode="numeric"
          maxLength={6}
          placeholder="Optional"
        />
      </EntityForm.Field>

      {/* Hidden branch */}
      {branches.length > 1 ? (
        <EntityForm.Field label="Branch" error={errors.branchId?.message} required>
          <select {...register("branchId")} className={fc}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </EntityForm.Field>
      ) : (
        <input type="hidden" {...register("branchId")} />
      )}

      {/* ── Enquiry Details ─────────────────────────────────────── */}
      <EntityForm.Field label="Basic Requirement" error={errors.requirement?.message} span={2}>
        <textarea
          {...register("requirement")}
          rows={3}
          className={`${fc} h-auto py-2 resize-y`}
          placeholder="Briefly describe what the customer is looking for (curtains, flooring, wallpaper…)"
        />
      </EntityForm.Field>

      {/* ── Lead Assignment ─────────────────────────────────────── */}
      <EntityForm.Field label="Lead Source" error={errors.source?.message} required>
        <select {...register("source")} className={fc} defaultValue="">
          <option value="" disabled>Select source</option>
          {LEAD_SOURCE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </EntityForm.Field>

      <EntityForm.Field label="Lead Priority" error={errors.priority?.message}
        hint="Default: Warm">
        <select {...register("priority")} className={fc}>
          {LEAD_PRIORITY_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </EntityForm.Field>

      <EntityForm.Field label="Assigned Sales Executive" error={errors.ownerId?.message} hint="Leave blank to assign to yourself" span={2}>
        <select {...register("ownerId")} className={fc} defaultValue="">
          <option value="">Unassigned (defaults to you)</option>
          {salesUsers.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </EntityForm.Field>
    </EntityForm>
  );
}
