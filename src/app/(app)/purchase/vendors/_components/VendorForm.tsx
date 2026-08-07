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
import { EntityForm } from "@/components/data/EntityForm";

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
      name:         initial?.name         ?? "",
      mobile:       initial?.mobile       ?? "",
      email:        initial?.email        ?? "",
      gstin:        initial?.gstin        ?? "",
      pan:          initial?.pan          ?? "",
      stateCode:    initial?.stateCode    ?? "33",
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
    <EntityForm
      onSubmit={handleSubmit(onSubmit)}
      pending={pending}
      serverError={serverError}
      submitLabel={mode === "edit" ? "Save changes" : "Create vendor"}
      onCancel={() => router.back()}
    >
      <EntityForm.Field label="Name" error={errors.name?.message} required>
        <input {...register("name")} className={EntityForm.fieldCls} autoFocus />
      </EntityForm.Field>
      <EntityForm.Field label="Mobile" error={errors.mobile?.message} required hint="10 digits or +91-prefixed">
        <input {...register("mobile")} className={`${EntityForm.fieldCls} tabular`} inputMode="tel" />
      </EntityForm.Field>
      <EntityForm.Field label="Email" error={errors.email?.message}>
        <input {...register("email")} className={EntityForm.fieldCls} type="email" />
      </EntityForm.Field>
      <EntityForm.Field label="GSTIN" error={errors.gstin?.message} hint="Optional. 15 chars">
        <input {...register("gstin")} className={`${EntityForm.fieldCls} tabular uppercase`} />
      </EntityForm.Field>
      <EntityForm.Field label="PAN" error={errors.pan?.message}>
        <input {...register("pan")} className={`${EntityForm.fieldCls} tabular uppercase`} />
      </EntityForm.Field>
      <EntityForm.Field label="State code" error={errors.stateCode?.message} required hint="2-digit. 33 = Tamil Nadu">
        <input {...register("stateCode")} className={`${EntityForm.fieldCls} tabular`} maxLength={2} />
      </EntityForm.Field>
      <EntityForm.Field label="Payment terms" error={errors.paymentTerms?.message} required hint="Days">
        <input {...register("paymentTerms", { valueAsNumber: true })} type="number" className={`${EntityForm.fieldCls} tabular`} />
      </EntityForm.Field>
    </EntityForm>
  );
}
