"use client";

// New Product form.
//
// Captures the minimum fields to stand up a Brand → Collection → Design
// → Colourway chain in a single server action. Image upload is a
// two-step submit: create the product first (returns a colourway id),
// then POST the file to /api/products/upload-image with that id. If
// the upload fails we still succeed the create — a filled-out form
// shouldn't be lost to an upload glitch.

import { useRef, useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createProductSchema, FAMILY_OPTIONS, SELL_UNIT_OPTIONS, GST_SLABS,
  type CreateProductInput,
} from "@/modules/products/schema";
import { createProduct } from "@/modules/products/actions";
import { EntityForm } from "@/components/data/EntityForm";

interface ProductFormProps {
  mode:    "create";
  brands:  Array<{ id: string; name: string }>;
  initial?: Partial<CreateProductInput>;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export function ProductForm({ brands, initial }: ProductFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    register, handleSubmit, formState: { errors }, setError,
  } = useForm<CreateProductInput>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      code:      initial?.code      ?? "",
      name:      initial?.name      ?? "",
      family:    initial?.family    ?? "CURTAIN_FABRIC",
      brandName: initial?.brandName ?? "",
      hsn:       initial?.hsn       ?? "",
      gstRate:   initial?.gstRate   ?? 18,
      sellUnit:  initial?.sellUnit  ?? "PIECE",
      mrp:       initial?.mrp       ?? "",
      cost:      initial?.cost      ?? "",
    },
  });

  function onImageChange(e: ChangeEvent<HTMLInputElement>): void {
    setImageError(null);
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setImagePreview(null);
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setImageError("Use JPG, PNG or WebP.");
      setImagePreview(null);
      e.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError(`Too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 5 MB.`);
      setImagePreview(null);
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImagePreview(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  }

  function onSubmit(values: CreateProductInput): void {
    setServerError(null);
    startTransition(async () => {
      const res = await createProduct(values);
      if (!res.ok) {
        if (res.fieldErrors) {
          for (const [k, msg] of Object.entries(res.fieldErrors)) {
            setError(k as keyof CreateProductInput, { message: msg });
          }
        }
        setServerError(res.error ?? "Something went wrong");
        return;
      }
      const id = res.data!.id;

      const file = fileRef.current?.files?.[0];
      if (file) {
        try {
          const fd = new FormData();
          fd.set("colourwayId", id);
          fd.set("file", file);
          const up = await fetch("/api/products/upload-image", { method: "POST", body: fd });
          if (!up.ok) {
            const body = (await up.json().catch(() => ({}))) as { error?: string };
            // Soft-fail — surface a message on the destination page via querystring.
            const reason = body.error ?? `upload failed (${up.status})`;
            router.push((`/products/${id}?uploadError=${encodeURIComponent(reason)}`) as Route);
            router.refresh();
            return;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "upload failed";
          router.push((`/products/${id}?uploadError=${encodeURIComponent(msg)}`) as Route);
          router.refresh();
          return;
        }
      }

      router.push(`/products/${id}` as Route);
      router.refresh();
    });
  }

  return (
    <EntityForm
      onSubmit={handleSubmit(onSubmit)}
      pending={pending}
      serverError={serverError}
      submitLabel="Create product"
      onCancel={() => router.back()}
      columns={3}
    >
      <EntityForm.Field label="Code" error={errors.code?.message} required hint="Internal SKU. Must be unique.">
        <input
          {...register("code")}
          className={`${EntityForm.fieldCls} tabular uppercase`}
          autoFocus
        />
      </EntityForm.Field>
      <EntityForm.Field label="Name" error={errors.name?.message} required span={2}>
        <input {...register("name")} className={EntityForm.fieldCls} />
      </EntityForm.Field>

      <EntityForm.Field label="Category" error={errors.family?.message} required hint="Product family drives quotes and calculators.">
        <select {...register("family")} className={EntityForm.fieldCls}>
          {FAMILY_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </EntityForm.Field>
      <EntityForm.Field label="Brand" error={errors.brandName?.message} required hint="Pick or type a new brand name.">
        <input
          {...register("brandName")}
          list="brand-suggestions"
          className={EntityForm.fieldCls}
          placeholder="e.g. Mandovara"
        />
        <datalist id="brand-suggestions">
          {brands.map((b) => (
            <option key={b.id} value={b.name} />
          ))}
        </datalist>
      </EntityForm.Field>
      <EntityForm.Field label="Unit" error={errors.sellUnit?.message} required hint="How this SKU is sold.">
        <select {...register("sellUnit")} className={`${EntityForm.fieldCls} tabular`}>
          {SELL_UNIT_OPTIONS.map((u) => (
            <option key={u.value} value={u.value}>{u.label}</option>
          ))}
        </select>
      </EntityForm.Field>

      <EntityForm.Field label="HSN" error={errors.hsn?.message} required hint="4–8 digit HSN code">
        <input {...register("hsn")} className={`${EntityForm.fieldCls} tabular`} inputMode="numeric" />
      </EntityForm.Field>
      <EntityForm.Field label="GST %" error={errors.gstRate?.message} required>
        <select
          {...register("gstRate", { valueAsNumber: true })}
          className={`${EntityForm.fieldCls} tabular`}
        >
          {GST_SLABS.map((s) => (
            <option key={s} value={Number(s)}>{s}%</option>
          ))}
        </select>
      </EntityForm.Field>
      <EntityForm.Field label="MRP" error={errors.mrp?.message} required hint="Rupees. e.g. 1200 or 12,500">
        <input {...register("mrp")} className={`${EntityForm.fieldCls} tabular`} inputMode="decimal" />
      </EntityForm.Field>

      <EntityForm.Field label="Cost" error={errors.cost?.message} hint="Optional. Requires viewCost permission.">
        <input {...register("cost")} className={`${EntityForm.fieldCls} tabular`} inputMode="decimal" />
      </EntityForm.Field>

      <EntityForm.Field
        label="Image"
        error={imageError ?? undefined}
        hint="JPG, PNG or WebP. Max 5 MB. Optional."
        span={2}
      >
        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            onChange={onImageChange}
            className="text-[12.5px] text-text file:mr-3 file:h-[30px] file:px-3 file:rounded-[6px] file:border-0 file:bg-accent file:text-white file:text-[12px] file:font-medium file:cursor-pointer hover:file:bg-accent-hover"
          />
          {imagePreview && (
            <img
              src={imagePreview}
              alt="Preview"
              className="h-[46px] w-[46px] rounded-[6px] object-cover border border-rule"
            />
          )}
        </div>
      </EntityForm.Field>
    </EntityForm>
  );
}
