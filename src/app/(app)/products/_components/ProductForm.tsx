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
      code: initial?.code ?? "",
      name: initial?.name ?? "",
      categoryName: initial?.categoryName ?? "",
      hsn: initial?.hsn ?? "",
      uom: initial?.uom ?? "NOS",
      uomPrecision: initial?.uomPrecision ?? 0,
      gstRate: initial?.gstRate ?? 18,
      mrp: initial?.mrp ?? "",
      cost: initial?.cost ?? "",
      reorderLevel: initial?.reorderLevel ?? "",
      minStock: initial?.minStock ?? "",
      trackBatch: initial?.trackBatch ?? false,
      trackSerial: initial?.trackSerial ?? false,
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
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-[14px] bg-surface border border-rule p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
        <Field label="Code" error={errors.code?.message} required hint="Internal SKU. Must be unique.">
          <input {...register("code")} className={`${fieldCls} tabular uppercase`} autoFocus />
        </Field>
        <Field label="Name" error={errors.name?.message} required span={2}>
          <input {...register("name")} className={fieldCls} />
        </Field>

        <Field
          label="Category"
          error={errors.categoryName?.message}
          required
          hint={isNewCategory ? `Will create new category "${catName!.trim()}"` : "Pick or type a new name"}
        >
          <input
            {...register("categoryName")}
            list="cat-suggestions"
            className={fieldCls}
            placeholder="e.g. Fittings"
          />
          <datalist id="cat-suggestions">
            {categories.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </Field>
        <Field label="HSN" error={errors.hsn?.message} required hint="4–8 digit HSN code">
          <input {...register("hsn")} className={`${fieldCls} tabular`} inputMode="numeric" />
        </Field>
        <Field label="GST %" error={errors.gstRate?.message} required>
          <select {...register("gstRate", { valueAsNumber: true })} className={`${fieldCls} tabular`}>
            {GST_SLABS.map((s) => (
              <option key={s} value={Number(s)}>{s}%</option>
            ))}
          </select>
        </Field>

        <Field label="UOM" error={errors.uom?.message} required>
          <input {...register("uom")} list="uom-suggestions" className={`${fieldCls} tabular uppercase`} />
          <datalist id="uom-suggestions">
            {COMMON_UOMS.map((u) => <option key={u} value={u} />)}
          </datalist>
        </Field>
        <Field label="Precision" error={errors.uomPrecision?.message} required hint="Decimal places. 0 for pieces, 2 for kg.">
          <input {...register("uomPrecision", { valueAsNumber: true })} type="number" min={0} max={4} className={`${fieldCls} tabular`} />
        </Field>
        <Field label="Reorder level" error={errors.reorderLevel?.message} hint="Below this, warn.">
          <input {...register("reorderLevel")} className={`${fieldCls} tabular`} inputMode="decimal" />
        </Field>

        <Field label="MRP" error={errors.mrp?.message} required hint="e.g. 12500, 1.25L">
          <input {...register("mrp")} className={`${fieldCls} tabular`} inputMode="decimal" />
        </Field>
        <Field label="Cost" error={errors.cost?.message} hint="Optional. Requires viewCost permission.">
          <input {...register("cost")} className={`${fieldCls} tabular`} inputMode="decimal" />
        </Field>
        <Field label="Min stock" error={errors.minStock?.message} hint="Hard floor, blocks issue.">
          <input {...register("minStock")} className={`${fieldCls} tabular`} inputMode="decimal" />
        </Field>

        <label className="flex items-center gap-2 text-[12.5px] text-text mt-2">
          <input type="checkbox" {...register("trackBatch")} className="accent-accent" />
          Track batches
        </label>
        <label className="flex items-center gap-2 text-[12.5px] text-text mt-2">
          <input type="checkbox" {...register("trackSerial")} className="accent-accent" />
          Track serials
        </label>
      </div>

      {serverError && <div className="mt-4 text-[12px] text-bad">{serverError}</div>}

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
          {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Create product"}
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
  label: string; error?: string; required?: boolean; hint?: string; span?: 1 | 2 | 3;
  children: React.ReactNode;
}) {
  const spanCls = span === 3 ? "col-span-3" : span === 2 ? "lg:col-span-2" : undefined;
  return (
    <div className={spanCls}>
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
