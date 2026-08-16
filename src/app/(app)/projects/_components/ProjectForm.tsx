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
import { EntityForm } from "@/components/data/EntityForm";

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
    <EntityForm
      onSubmit={handleSubmit(onSubmit)}
      pending={pending}
      serverError={serverError}
      submitLabel={pending ? "Creating…" : "Create project"}
      onCancel={() => router.back()}
    >
      <EntityForm.Field label="Project name" error={errors.name?.message} required>
        <input {...register("name")} className={EntityForm.fieldCls} autoFocus placeholder="e.g. Sunrise Cafe — full interior" />
      </EntityForm.Field>
      <EntityForm.Field label="Client" error={errors.clientId?.message} required>
        <select {...register("clientId")} className={EntityForm.fieldCls}>
          <option value="">— pick a client —</option>
          {clients.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
        </select>
      </EntityForm.Field>
      {/* FIXES-01 §6 — hide the selector when the org has one branch;
          keep as a hidden input so branchId still ships in the payload. */}
      {branches.length > 1 ? (
        <EntityForm.Field label="Branch" error={errors.branchId?.message} required>
          <select {...register("branchId")} className={EntityForm.fieldCls}>
            {branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
          </select>
        </EntityForm.Field>
      ) : (
        <input type="hidden" {...register("branchId")} />
      )}
      <EntityForm.Field label="Order value" error={errors.orderValue?.message} required hint="e.g. 500000 or 5L">
        <input {...register("orderValue")} inputMode="decimal" className={`${EntityForm.fieldCls} tabular`} />
      </EntityForm.Field>
      <EntityForm.Field label="Start date" error={errors.startDate?.message} required>
        <input {...register("startDate")} type="date" className={`${EntityForm.fieldCls} tabular`} />
      </EntityForm.Field>
      <EntityForm.Field label="Target end date" error={errors.targetEndDate?.message}>
        <input {...register("targetEndDate")} type="date" className={`${EntityForm.fieldCls} tabular`} />
      </EntityForm.Field>
    </EntityForm>
  );
}

function iso(d: Date): string { return d.toISOString().slice(0, 10); }
