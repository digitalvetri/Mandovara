"use client";

// Edit form for a Colourway. Wraps updateProduct with:
//   - basics (code, name, HSN, GST, sell unit)
//   - physical specs (pile height mm, GSM)
//   - free-form specs (pile yarn, points, extra k/v rows)
//   - size-price grid (3x5, 4x6, 5x7, 6x9, RUNNER + any extra sizes)
//
// Uses react-hook-form + zod like ProductForm.tsx but on the fuller
// updateProductSchema. Live-add rows for extraSpecs / sizePrices are
// plain useState arrays kept in sync with hidden inputs via setValue.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import {
  updateProductSchema, RUG_SIZE_TIERS, SELL_UNIT_OPTIONS, GST_SLABS,
} from "@/modules/products/schema";
import { updateProduct } from "@/modules/products/actions-part2";
import type { ProductEditSnapshot } from "@/modules/products/queries";
import { EntityForm } from "@/components/data/EntityForm";

// The form values are the schema's inferred type — keeps RHF/zod
// happy without a parallel hand-rolled interface.
type FormValues = z.infer<typeof updateProductSchema>;

interface Props {
  initial: ProductEditSnapshot;
}

export function ProductEditForm({ initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  // Seed size prices with the standard rug tiers if the SKU has none —
  // makes the empty form immediately fillable in the common case.
  const seededSizes = initial.sizePrices.length > 0
    ? initial.sizePrices
    : RUG_SIZE_TIERS.map((t) => ({ tier: t, price: "" }));

  const { register, handleSubmit, control, formState: { errors }, setError } = useForm<FormValues>({
    resolver: zodResolver(updateProductSchema) as Resolver<FormValues>,
    defaultValues: {
      id: initial.id,
      code: initial.code,
      name: initial.name,
      hsn: initial.hsn,
      gstRate: initial.gstRate,
      sellUnit: initial.sellUnit as FormValues["sellUnit"],
      pileHeightMm: initial.pileHeightMm === "" ? "" : Number(initial.pileHeightMm),
      gsm:          initial.gsm === "" ? "" : Number(initial.gsm),
      pileYarn:  initial.pileYarn,
      points:    initial.points,
      cost:      initial.cost,
      extraSpecs: initial.extraSpecs,
      sizePrices: seededSizes,
    },
  });

  const sizePricesFA = useFieldArray({ control, name: "sizePrices" });
  const extraSpecsFA = useFieldArray({ control, name: "extraSpecs" });

  function onSubmit(values: FormValues): void {
    setServerError(null);
    startTransition(async () => {
      // Blank strings on numeric fields → null so schema accepts them.
      const payload = {
        ...values,
        pileHeightMm: values.pileHeightMm === "" ? null : values.pileHeightMm,
        gsm:          values.gsm === "" ? null : values.gsm,
      };
      const res = await updateProduct(payload);
      if (!res.ok) {
        if (res.fieldErrors) {
          for (const [k, msg] of Object.entries(res.fieldErrors)) {
            setError(k as keyof FormValues, { message: msg });
          }
        }
        setServerError(res.error ?? "Update failed");
        return;
      }
      router.push(`/products/${initial.id}` as Route);
      router.refresh();
    });
  }

  return (
    <EntityForm
      onSubmit={handleSubmit(onSubmit)}
      pending={pending}
      serverError={serverError}
      submitLabel="Save changes"
      onCancel={() => router.push(`/products/${initial.id}` as Route)}
      columns={3}
    >
      {/* ── Basics ───────────────────────────────────────────── */}
      <SectionHeader label="Basics" />
      <EntityForm.Field label="Code" error={errors.code?.message} required>
        <input {...register("code")} className={`${EntityForm.fieldCls} tabular uppercase`} />
      </EntityForm.Field>
      <EntityForm.Field label="Name" error={errors.name?.message} required span={2}>
        <input {...register("name")} className={EntityForm.fieldCls} />
      </EntityForm.Field>

      <EntityForm.Field label="HSN" error={errors.hsn?.message} required>
        <input {...register("hsn")} className={`${EntityForm.fieldCls} tabular`} inputMode="numeric" />
      </EntityForm.Field>
      <EntityForm.Field label="GST %" error={errors.gstRate?.message} required>
        <select {...register("gstRate", { valueAsNumber: true })} className={`${EntityForm.fieldCls} tabular`}>
          {GST_SLABS.map((s) => (
            <option key={s} value={Number(s)}>{s}%</option>
          ))}
        </select>
      </EntityForm.Field>
      <EntityForm.Field label="Unit" error={errors.sellUnit?.message} required>
        <select {...register("sellUnit")} className={`${EntityForm.fieldCls} tabular`}>
          {SELL_UNIT_OPTIONS.map((u) => (
            <option key={u.value} value={u.value}>{u.label}</option>
          ))}
        </select>
      </EntityForm.Field>

      {/* ── Physical specs ──────────────────────────────────── */}
      <SectionHeader label="Physical specs" />
      <EntityForm.Field
        label="Pile height (mm)"
        error={errors.pileHeightMm?.message as string | undefined}
        hint="From the PDF header, e.g. 10"
      >
        <input
          type="number" step="0.1" min="0"
          {...register("pileHeightMm", { setValueAs: (v) => v === "" ? "" : Number(v) })}
          className={`${EntityForm.fieldCls} tabular`}
        />
      </EntityForm.Field>
      <EntityForm.Field
        label="Total weight (GSM)"
        error={errors.gsm?.message as string | undefined}
        hint="e.g. 2300"
      >
        <input
          type="number" step="1" min="0"
          {...register("gsm", { setValueAs: (v) => v === "" ? "" : Number(v) })}
          className={`${EntityForm.fieldCls} tabular`}
        />
      </EntityForm.Field>
      <EntityForm.Field
        label="Points"
        error={errors.points?.message}
        hint="Density in points, e.g. 462000"
      >
        <input {...register("points")} className={`${EntityForm.fieldCls} tabular`} />
      </EntityForm.Field>

      <EntityForm.Field
        label="Pile yarn / composition"
        error={errors.pileYarn?.message}
        span={3}
        hint="e.g. 60% PP Heatset & 40% Polyester"
      >
        <input {...register("pileYarn")} className={EntityForm.fieldCls} />
      </EntityForm.Field>

      {/* ── Extra spec rows (free-form) ─────────────────────── */}
      <SectionHeader
        label="More specs"
        action={
          <button
            type="button"
            onClick={() => extraSpecsFA.append({ key: "", value: "" })}
            className="inline-flex items-center gap-1 text-[11.5px] text-accent hover:text-accent-hover"
          >
            <Plus size={12} /> Add row
          </button>
        }
      />
      {extraSpecsFA.fields.length === 0 && (
        <div className="col-span-3 text-[11.5px] text-text-faint">No extra specs — click "Add row" to add fields like "Backing", "Finish", "Origin".</div>
      )}
      {extraSpecsFA.fields.map((field, idx) => (
        <div key={field.id} className="col-span-3 grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] gap-3 items-start">
          <div>
            <input
              placeholder="Label (e.g. Backing)"
              {...register(`extraSpecs.${idx}.key` as const)}
              className={EntityForm.fieldCls}
            />
          </div>
          <div>
            <input
              placeholder="Value"
              {...register(`extraSpecs.${idx}.value` as const)}
              className={EntityForm.fieldCls}
            />
          </div>
          <button
            type="button"
            onClick={() => extraSpecsFA.remove(idx)}
            className="h-[34px] w-[34px] rounded-[6px] border border-rule text-text-dim hover:text-bad hover:border-bad transition-colors flex items-center justify-center"
            aria-label="Remove row"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      {/* ── Size prices ─────────────────────────────────────── */}
      <SectionHeader
        label="Prices per size (₹)"
        action={
          <button
            type="button"
            onClick={() => sizePricesFA.append({ tier: "", price: "" })}
            className="inline-flex items-center gap-1 text-[11.5px] text-accent hover:text-accent-hover"
          >
            <Plus size={12} /> Add size
          </button>
        }
      />
      {sizePricesFA.fields.map((field, idx) => (
        <div key={field.id} className="col-span-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 items-start">
          <div>
            <input
              placeholder='Size (e.g. 3x5 or RUNNER)'
              {...register(`sizePrices.${idx}.tier` as const)}
              className={`${EntityForm.fieldCls} tabular uppercase`}
            />
          </div>
          <div>
            <input
              placeholder="Price in ₹ (e.g. 7100)"
              inputMode="decimal"
              {...register(`sizePrices.${idx}.price` as const)}
              className={`${EntityForm.fieldCls} tabular`}
            />
          </div>
          <button
            type="button"
            onClick={() => sizePricesFA.remove(idx)}
            className="h-[34px] w-[34px] rounded-[6px] border border-rule text-text-dim hover:text-bad hover:border-bad transition-colors flex items-center justify-center"
            aria-label="Remove size"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      <EntityForm.Field
        label="Cost price (₹, optional)"
        error={errors.cost?.message}
        hint="Requires permission to view/set cost."
        span={3}
      >
        <input
          {...register("cost")}
          inputMode="decimal"
          placeholder="e.g. 4200"
          className={`${EntityForm.fieldCls} tabular max-w-[240px]`}
        />
      </EntityForm.Field>
    </EntityForm>
  );
}

function SectionHeader({ label, action }: { label: string; action?: React.ReactNode }) {
  return (
    <div className="col-span-3 flex items-baseline justify-between pt-3 border-b border-rule pb-1.5 mb-1">
      <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">{label}</div>
      {action}
    </div>
  );
}
