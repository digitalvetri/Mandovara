"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createProductSchema, COMMON_UOMS, GST_SLABS, type CreateProductInput,
} from "@/modules/products/schema";
import { createProduct, updateProduct } from "@/modules/products/actions";
import type { CategoryOption } from "@/modules/products/queries";
import { EntityForm } from "@/components/data/EntityForm";

interface ProductFormProps {
  mode: "create" | "edit";
  categories: CategoryOption[];
  initial?: Partial<CreateProductInput> & { id?: string };
}

export function ProductForm({ mode, categories, initial }: ProductFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register, handleSubmit, formState: { errors }, setError, watch,
  } = useForm<CreateProductInput>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      code:         initial?.code         ?? "",
      name:         initial?.name         ?? "",
      categoryName: initial?.categoryName ?? "",
      hsn:          initial?.hsn          ?? "",
      uom:          initial?.uom          ?? "NOS",
      uomPrecision: initial?.uomPrecision ?? 0,
      gstRate:      initial?.gstRate      ?? 18,
      mrp:          initial?.mrp          ?? "",
      cost:         initial?.cost         ?? "",
      reorderLevel: initial?.reorderLevel ?? "",
      minStock:     initial?.minStock     ?? "",
      trackBatch:   initial?.trackBatch   ?? false,
      trackSerial:  initial?.trackSerial  ?? false,
    },
  });

  const catName = watch("categoryName");
  const isNewCategory = catName != null && catName.trim().length > 0 &&
    !categories.some((c) => c.name.toLowerCase() === catName.trim().toLowerCase());

  function onSubmit(values: CreateProductInput) {
    setServerError(null);
    startTransition(async () => {
      const payload = mode === "edit" && initial?.id
        ? { ...values, id: initial.id }
        : values;
      const result = mode === "edit"
        ? await updateProduct(payload)
        : await createProduct(payload);
      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [k, msg] of Object.entries(result.fieldErrors)) {
            setError(k as keyof CreateProductInput, { message: msg });
          }
        }
        setServerError(result.error ?? "Something went wrong");
        return;
      }
      const targetId = result.data?.id ?? initial?.id;
      const target = (targetId ? `/products/${targetId}` : "/products") as Route;
      router.push(target);
      router.refresh();
    });
  }

  return (
    <EntityForm
      onSubmit={handleSubmit(onSubmit)}
      pending={pending}
      serverError={serverError}
      submitLabel={mode === "edit" ? "Save changes" : "Create product"}
      onCancel={() => router.back()}
      columns={3}
    >
      <EntityForm.Field label="Code" error={errors.code?.message} required hint="Internal SKU. Must be unique.">
        <input {...register("code")} className={`${EntityForm.fieldCls} tabular uppercase`} autoFocus />
      </EntityForm.Field>
      <EntityForm.Field label="Name" error={errors.name?.message} required span={2}>
        <input {...register("name")} className={EntityForm.fieldCls} />
      </EntityForm.Field>

      <EntityForm.Field
        label="Category"
        error={errors.categoryName?.message}
        required
        hint={isNewCategory ? `Will create new category "${catName!.trim()}"` : "Pick or type a new name"}
      >
        <input
          {...register("categoryName")}
          list="cat-suggestions"
          className={EntityForm.fieldCls}
          placeholder="e.g. Fittings"
        />
        <datalist id="cat-suggestions">
          {categories.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
      </EntityForm.Field>
      <EntityForm.Field label="HSN" error={errors.hsn?.message} required hint="4–8 digit HSN code">
        <input {...register("hsn")} className={`${EntityForm.fieldCls} tabular`} inputMode="numeric" />
      </EntityForm.Field>
      <EntityForm.Field label="GST %" error={errors.gstRate?.message} required>
        <select {...register("gstRate", { valueAsNumber: true })} className={`${EntityForm.fieldCls} tabular`}>
          {GST_SLABS.map((s) => (
            <option key={s} value={Number(s)}>{s}%</option>
          ))}
        </select>
      </EntityForm.Field>

      <EntityForm.Field label="UOM" error={errors.uom?.message} required>
        <input {...register("uom")} list="uom-suggestions" className={`${EntityForm.fieldCls} tabular uppercase`} />
        <datalist id="uom-suggestions">
          {COMMON_UOMS.map((u) => <option key={u} value={u} />)}
        </datalist>
      </EntityForm.Field>
      <EntityForm.Field label="Precision" error={errors.uomPrecision?.message} required hint="Decimal places. 0 for pieces, 2 for kg.">
        <input {...register("uomPrecision", { valueAsNumber: true })} type="number" min={0} max={4} className={`${EntityForm.fieldCls} tabular`} />
      </EntityForm.Field>
      <EntityForm.Field label="Reorder level" error={errors.reorderLevel?.message} hint="Below this, warn.">
        <input {...register("reorderLevel")} className={`${EntityForm.fieldCls} tabular`} inputMode="decimal" />
      </EntityForm.Field>

      <EntityForm.Field label="MRP" error={errors.mrp?.message} required hint="e.g. 12500, 1.25L">
        <input {...register("mrp")} className={`${EntityForm.fieldCls} tabular`} inputMode="decimal" />
      </EntityForm.Field>
      <EntityForm.Field label="Cost" error={errors.cost?.message} hint="Optional. Requires viewCost permission.">
        <input {...register("cost")} className={`${EntityForm.fieldCls} tabular`} inputMode="decimal" />
      </EntityForm.Field>
      <EntityForm.Field label="Min stock" error={errors.minStock?.message} hint="Hard floor, blocks issue.">
        <input {...register("minStock")} className={`${EntityForm.fieldCls} tabular`} inputMode="decimal" />
      </EntityForm.Field>

      <label className="flex items-center gap-2 text-[12.5px] text-text mt-2">
        <input type="checkbox" {...register("trackBatch")} className="accent-accent" />
        Track batches
      </label>
      <label className="flex items-center gap-2 text-[12.5px] text-text mt-2">
        <input type="checkbox" {...register("trackSerial")} className="accent-accent" />
        Track serials
      </label>
    </EntityForm>
  );
}
