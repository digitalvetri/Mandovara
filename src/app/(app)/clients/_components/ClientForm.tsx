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
import { EntityForm } from "@/components/data/EntityForm";

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
      name:          initial?.name          ?? "",
      type:          initial?.type          ?? "RETAIL",
      primaryMobile: initial?.primaryMobile ?? "",
      primaryEmail:  initial?.primaryEmail  ?? "",
      gstin:         initial?.gstin         ?? "",
      pan:           initial?.pan           ?? "",
      stateCode:     initial?.stateCode     ?? "33",
      paymentTerms:  initial?.paymentTerms  ?? 30,
      creditLimit:   initial?.creditLimit   ?? "",
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
    <EntityForm
      onSubmit={handleSubmit(onSubmit)}
      pending={pending}
      serverError={serverError}
      submitLabel={mode === "edit" ? "Save changes" : "Create client"}
      onCancel={() => router.back()}
    >
      <EntityForm.Field label="Name" error={errors.name?.message} required>
        <input {...register("name")} className={EntityForm.fieldCls} autoFocus />
      </EntityForm.Field>
      <EntityForm.Field label="Type" error={errors.type?.message} required>
        <select {...register("type")} className={EntityForm.fieldCls}>
          {CLIENT_TYPES.map((t) => (
            <option key={t} value={t}>{TYPE_LABEL[t] ?? t}</option>
          ))}
        </select>
      </EntityForm.Field>
      <EntityForm.Field label="Primary mobile" error={errors.primaryMobile?.message} required hint="10 digits or +91-prefixed">
        <input {...register("primaryMobile")} className={`${EntityForm.fieldCls} tabular`} inputMode="tel" />
      </EntityForm.Field>
      <EntityForm.Field label="Primary email" error={errors.primaryEmail?.message}>
        <input {...register("primaryEmail")} className={EntityForm.fieldCls} type="email" />
      </EntityForm.Field>
      <EntityForm.Field label="GSTIN" error={errors.gstin?.message} hint="Optional. 15 chars, e.g. 33ABCDE1234F1Z5">
        <input {...register("gstin")} className={`${EntityForm.fieldCls} tabular uppercase`} />
      </EntityForm.Field>
      <EntityForm.Field label="PAN" error={errors.pan?.message}>
        <input {...register("pan")} className={`${EntityForm.fieldCls} tabular uppercase`} />
      </EntityForm.Field>
      <EntityForm.Field label="State code" error={errors.stateCode?.message} required hint="2-digit code. 33 = Tamil Nadu">
        <input {...register("stateCode")} className={`${EntityForm.fieldCls} tabular`} maxLength={2} />
      </EntityForm.Field>
      <EntityForm.Field label="Payment terms" error={errors.paymentTerms?.message} required hint="Days">
        <input {...register("paymentTerms", { valueAsNumber: true })} type="number" className={`${EntityForm.fieldCls} tabular`} />
      </EntityForm.Field>
      <EntityForm.Field label="Credit limit" error={errors.creditLimit?.message} hint="e.g. 500000, 5L, 5 lakh — optional">
        <input {...register("creditLimit")} className={`${EntityForm.fieldCls} tabular`} inputMode="decimal" />
      </EntityForm.Field>
    </EntityForm>
  );
}
