"use client";

// <EntityForm> — the shared shell for every create/edit form in the app.
//
// Sibling contract to <DataTable>: hand-rolled forms all share the same
// card + grid + label/error slot + Cancel/Submit bar today. This
// component extracts that shell so a form module only writes:
//
//   <EntityForm onSubmit={handleSubmit(onSubmit)}
//               pending={pending}
//               serverError={serverError}
//               submitLabel="Create lead"
//               onCancel={() => router.back()}>
//     <EntityForm.Field label="Full name" required error={errors.name?.message}>
//       <input {...register("name")} className={EntityForm.fieldCls} />
//     </EntityForm.Field>
//     …
//   </EntityForm>
//
// The component is unopinionated about the form library — it takes
// onSubmit, pending and serverError as plain props so react-hook-form,
// FormData, or any other approach plugs in cleanly.
//
// TRACK-B-CRAFT.md §9 W6 gate: "the whole project's critical path" —
// Dev A cannot build a single create/edit screen until this exists.

import type React from "react";

export interface EntityFormProps {
  onSubmit:      (e: React.FormEvent<HTMLFormElement>) => void;
  pending?:      boolean;
  serverError?:  string | null;
  submitLabel:   string;
  onCancel?:     () => void;
  cancelLabel?:  string;
  children:      React.ReactNode;
  /** Number of columns for the field grid at ≥sm. Defaults to 2. */
  columns?:      1 | 2 | 3;
}

function EntityFormImpl(props: EntityFormProps) {
  const cols = props.columns ?? 2;
  const gridCls =
    cols === 1
      ? "grid grid-cols-1 gap-x-6 gap-y-4"
      : cols === 3
      ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4"
      : "grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4";
  return (
    <form
      onSubmit={props.onSubmit}
      className="rounded-[14px] bg-surface border border-rule p-6"
      noValidate
    >
      <div className={gridCls}>{props.children}</div>

      {props.serverError && (
        <div className="mt-4 text-[12px] text-bad" role="alert">
          {props.serverError}
        </div>
      )}

      <div className="mt-6 flex items-center justify-end gap-3">
        {props.onCancel && (
          <button
            type="button"
            onClick={props.onCancel}
            className="h-[36px] px-4 rounded-[8px] text-[12.5px] text-text-dim hover:text-text hover:bg-surface-hover transition-colors"
          >
            {props.cancelLabel ?? "Cancel"}
          </button>
        )}
        <button
          type="submit"
          disabled={props.pending}
          className="h-[36px] px-5 rounded-[8px] bg-accent text-white text-[12.5px] font-medium hover:bg-accent-hover disabled:opacity-60 transition-colors"
        >
          {props.pending ? "Saving…" : props.submitLabel}
        </button>
      </div>
    </form>
  );
}

export interface FieldProps {
  label:     string;
  error?:    string;
  required?: boolean;
  hint?:     string;
  span?:     1 | 2 | 3;
  children:  React.ReactNode;
}

function Field(props: FieldProps) {
  const spanCls =
    props.span === 3 ? "sm:col-span-2 lg:col-span-3"
    : props.span === 2 ? "sm:col-span-2"
    : undefined;
  return (
    <div className={spanCls}>
      <div className="mb-1 text-[11px] tracking-[0.06em] uppercase text-text-dim">
        {props.label}
        {props.required && <span className="text-accent"> *</span>}
      </div>
      {props.children}
      <div className="mt-1 min-h-[14px] text-[11px]">
        {props.error ? (
          <span className="text-bad">{props.error}</span>
        ) : props.hint ? (
          <span className="text-text-faint">{props.hint}</span>
        ) : null}
      </div>
    </div>
  );
}

const fieldCls =
  "w-full h-[34px] px-3 bg-surface-2 border border-rule rounded-[6px] text-[12.5px] text-text placeholder:text-text-muted outline-none focus:border-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed read-only:opacity-70";

// Selects: white background (matches text inputs) so the selected value
// reads as clearly "filled" rather than muted against a grey surface.
const selectCls =
  "w-full h-[34px] px-3 bg-surface border border-rule rounded-[6px] text-[12.5px] text-text outline-none focus:border-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

// Namespace the ergonomics — one import per module.
export const EntityForm = Object.assign(EntityFormImpl, { Field, fieldCls, selectCls });
