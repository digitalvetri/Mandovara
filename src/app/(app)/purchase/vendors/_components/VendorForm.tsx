"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createVendorSchema, type CreateVendorInput,
} from "@/modules/vendors/schema";
import { createVendor, updateVendor } from "@/modules/vendors/actions";

interface Props {
  mode: "create" | "edit";
  initial?: Partial<CreateVendorInput> & { id?: string };
}

export function VendorForm({ mode, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register, handleSubmit, formState: { errors }, setError,
  } = useForm<CreateVendorInput>({
    resolver: zodResolver(createVendorSchema),
    defaultValues: {
      name: initial?.name ?? "",
      mobile: initial?.mobile ?? "",
      email: initial?.email ?? "",
      gstin: initial?.gstin ?? "",
      pan: initial?.pan ?? "",
      stateCode: initial?.stateCode ?? "33",
      paymentTerms: initial?.paymentTerms ?? 30,
    },
  });

  function onSubmit(values: CreateVendorInput) {
    setServerError(null);
    startTransition(async () => {
      const payload = mode === "edit" && initial?.id ? { ...values, id: initial.id } : values;
      const result = mode === "edit"
        ? await updateVendor(payload) : await createVendor(payload);
      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [k, msg] of Object.entries(result.fieldErrors)) {
            setError(k as keyof CreateVendorInput, { message: msg });
          }
        }
        setServerError(result.error ?? "Something went wrong");
        return;
      }
      const targetId = result.data?.id ?? initial?.id;
      router.push((targetId ? `/purchase/vendors/${targetId}` : "/purchase/vendors") as Route);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-[14px] bg-surface border border-rule p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
        <Field label="Name" error={errors.name?.message} required>
          <input {...register("name")} className={fieldCls} autoFocus />
        </Field>
        <Field label="Mobile" error={errors.mobile?.message} required hint="10 digits or +91-prefixed">
          <input {...register("mobile")} className={`${fieldCls} tabular`} inputMode="tel" />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <input {...register("email")} className={fieldCls} type="email" />
        </Field>
        <Field label="GSTIN" error={errors.gstin?.message} hint="Optional. 15 chars">
          <input {...register("gstin")} className={`${fieldCls} tabular uppercase`} />
        </Field>
        <Field label="PAN" error={errors.pan?.message}>
          <input {...register("pan")} className={`${fieldCls} tabular uppercase`} />
        </Field>
        <Field label="State code" error={errors.stateCode?.message} required hint="2-digit. 33 = Tamil Nadu">
          <input {...register("stateCode")} className={`${fieldCls} tabular`} maxLength={2} />
        </Field>
        <Field label="Payment terms" error={errors.paymentTerms?.message} required hint="Days">
          <input {...register("paymentTerms", { valueAsNumber: true })} type="number" className={`${fieldCls} tabular`} />
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
          {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Create vendor"}
        </button>
      </div>
    </form>
  );
}

const fieldCls =
  "w-full h-[34px] px-3 bg-white/60 border border-rule rounded-[6px] text-[12.5px] outline-none focus:border-accent transition-colors";

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
