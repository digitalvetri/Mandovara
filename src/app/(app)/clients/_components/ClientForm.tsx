"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createClientSchema, CLIENT_TYPES, type CreateClientInput,
} from "@/modules/clients/schema";
import { createClient, updateClient } from "@/modules/clients/actions";

interface ClientFormProps {
  mode: "create" | "edit";
  initial?: Partial<CreateClientInput> & { id?: string };
}

const TYPE_LABEL: Record<string, string> = {
  DEALER: "Dealer", DISTRIBUTOR: "Distributor", RETAIL: "Retail",
  PROJECT: "Project", GOVERNMENT: "Government",
};

export function ClientForm({ mode, initial }: ClientFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register, handleSubmit, formState: { errors }, setError,
  } = useForm<CreateClientInput>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      name: initial?.name ?? "",
      type: initial?.type ?? "RETAIL",
      primaryMobile: initial?.primaryMobile ?? "",
      primaryEmail: initial?.primaryEmail ?? "",
      gstin: initial?.gstin ?? "",
      pan: initial?.pan ?? "",
      stateCode: initial?.stateCode ?? "33",
      paymentTerms: initial?.paymentTerms ?? 30,
      creditLimit: initial?.creditLimit ?? "",
    },
  });

  function onSubmit(values: CreateClientInput) {
    setServerError(null);
    startTransition(async () => {
      const payload = mode === "edit" && initial?.id
        ? { ...values, id: initial.id }
        : values;
      const result = mode === "edit"
        ? await updateClient(payload)
        : await createClient(payload);
      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [k, msg] of Object.entries(result.fieldErrors)) {
            setError(k as keyof CreateClientInput, { message: msg });
          }
        }
        setServerError(result.error ?? "Something went wrong");
        return;
      }
      const targetId = mode === "create" ? result.data?.id : initial?.id;
      const createTarget = (targetId ? `/clients/${targetId}` : "/clients") as Route;
      router.push(mode === "edit" ? ("/clients" as Route) : createTarget);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-[14px] bg-surface border border-rule p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
        <Field label="Name" error={errors.name?.message} required>
          <input {...register("name")} className={fieldCls} autoFocus />
        </Field>
        <Field label="Type" error={errors.type?.message} required>
          <select {...register("type")} className={fieldCls}>
            {CLIENT_TYPES.map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t] ?? t}</option>
            ))}
          </select>
        </Field>
        <Field label="Primary mobile" error={errors.primaryMobile?.message} required hint="10 digits or +91-prefixed">
          <input {...register("primaryMobile")} className={`${fieldCls} tabular`} inputMode="tel" />
        </Field>
        <Field label="Primary email" error={errors.primaryEmail?.message}>
          <input {...register("primaryEmail")} className={fieldCls} type="email" />
        </Field>
        <Field label="GSTIN" error={errors.gstin?.message} hint="Optional. 15 chars, e.g. 33ABCDE1234F1Z5">
          <input {...register("gstin")} className={`${fieldCls} tabular uppercase`} />
        </Field>
        <Field label="PAN" error={errors.pan?.message}>
          <input {...register("pan")} className={`${fieldCls} tabular uppercase`} />
        </Field>
        <Field label="State code" error={errors.stateCode?.message} required hint="2-digit code. 33 = Tamil Nadu">
          <input {...register("stateCode")} className={`${fieldCls} tabular`} maxLength={2} />
        </Field>
        <Field label="Payment terms" error={errors.paymentTerms?.message} required hint="Days">
          <input {...register("paymentTerms", { valueAsNumber: true })} type="number" className={`${fieldCls} tabular`} />
        </Field>
        <Field label="Credit limit" error={errors.creditLimit?.message} hint="e.g. 500000, 5L, 5 lakh — optional">
          <input {...register("creditLimit")} className={`${fieldCls} tabular`} inputMode="decimal" />
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
          {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Create client"}
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
