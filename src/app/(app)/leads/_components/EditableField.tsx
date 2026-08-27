"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X } from "lucide-react";
import { updateLead } from "@/modules/leads/actions";

type Option = { value: string; label: string };

interface Props {
  leadId: string;
  field: "name" | "mobile" | "email" | "source" | "estimatedBudget" | "requirement";
  value: string;
  displayValue?: string;
  placeholder?: string;
  label: string;
  icon?: React.ReactNode;
  size?: "sm" | "lg";
  variant?: "text" | "email" | "tel" | "select" | "textarea";
  options?: readonly Option[];
  readOnly?: boolean;
}

export function EditableField({
  leadId, field, value, displayValue, placeholder = "Add",
  label, icon, size = "sm", variant = "text", options, readOnly,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>(null);

  useEffect(() => { setDraft(value); }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if ("select" in inputRef.current) inputRef.current.select?.();
    }
  }, [editing]);

  function save() {
    if (draft === value) { setEditing(false); return; }
    setError(null);
    startTransition(async () => {
      const res = await updateLead({ id: leadId, [field]: draft });
      if (!res.ok) {
        setError(res.fieldErrors?.[field] ?? res.error ?? "Save failed");
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function cancel() {
    setDraft(value);
    setError(null);
    setEditing(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && variant !== "textarea") { e.preventDefault(); save(); }
    if (e.key === "Escape") { e.preventDefault(); cancel(); }
  }

  const displayText = displayValue ?? value ?? "";
  const isEmpty = displayText.trim().length === 0;

  const titleCls = size === "lg"
    ? "text-[26px] font-semibold text-text leading-tight"
    : "text-[13.5px] text-text";

  const inputCls = size === "lg"
    ? "w-full text-[26px] font-semibold text-text leading-tight bg-transparent border-b-2 border-accent outline-none py-0.5"
    : "w-full h-[32px] px-2 bg-surface border border-accent rounded-[6px] text-[13.5px] text-text outline-none";

  if (editing) {
    return (
      <div className="flex items-start gap-2 min-w-0">
        {icon && <span className="mt-1 text-text-dim shrink-0">{icon}</span>}
        <div className="flex-1 min-w-0">
          {variant === "select" && options ? (
            <select
              ref={inputRef as React.RefObject<HTMLSelectElement>}
              value={draft}
              onChange={(e) => { setDraft(e.target.value); }}
              onBlur={save}
              onKeyDown={onKey}
              disabled={pending}
              className={inputCls}
            >
              <option value="">— Not set —</option>
              {options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ) : variant === "textarea" ? (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              disabled={pending}
              rows={3}
              className={`${inputCls} h-auto resize-y py-2`}
              placeholder={placeholder}
            />
          ) : (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type={variant === "tel" ? "tel" : variant === "email" ? "email" : "text"}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={save}
              onKeyDown={onKey}
              disabled={pending}
              className={inputCls}
              placeholder={placeholder}
            />
          )}
          {error && <div className="mt-1 text-[11.5px] text-bad">{error}</div>}
        </div>
        {variant === "textarea" && (
          <div className="flex flex-col gap-1 shrink-0">
            <button
              type="button" onClick={save} disabled={pending}
              className="h-[26px] w-[26px] inline-flex items-center justify-center rounded-[6px] bg-accent text-white hover:bg-accent-hover disabled:opacity-60"
              title="Save"
            >
              <Check size={13} strokeWidth={2.2} />
            </button>
            <button
              type="button" onClick={cancel} disabled={pending}
              className="h-[26px] w-[26px] inline-flex items-center justify-center rounded-[6px] border border-rule text-text-dim hover:text-text hover:bg-surface-hover"
              title="Cancel"
            >
              <X size={13} strokeWidth={2.2} />
            </button>
          </div>
        )}
      </div>
    );
  }

  if (readOnly) {
    return (
      <div className="flex items-start gap-2 min-w-0 py-1 px-1 -mx-1">
        {icon && <span className="mt-0.5 text-text-dim shrink-0">{icon}</span>}
        <div className="flex-1 min-w-0">
          {size !== "lg" && (
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim mb-0.5">
              {label}
            </div>
          )}
          <div
            className={`${titleCls} truncate ${isEmpty ? "text-text-faint" : ""}`}
            {...(size === "lg" ? { role: "heading", "aria-level": 1 } : {})}
          >
            {isEmpty ? "—" : displayText}
          </div>
        </div>
      </div>
    );
  }

  // lg variant: heading + compact pencil button beside it (avoid full-width hover zone)
  if (size === "lg") {
    return (
      <div className="flex items-center gap-2 min-w-0">
        {icon && <span className="text-text-dim shrink-0">{icon}</span>}
        <div
          className={`${titleCls} truncate flex-1 min-w-0 ${isEmpty ? "text-text-faint" : ""}`}
          role="heading"
          aria-level={1}
        >
          {isEmpty ? placeholder : displayText}
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="Edit"
          className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded-[6px] text-text-faint border border-transparent hover:border-rule hover:text-text hover:bg-surface-hover transition-colors"
        >
          <Pencil size={13} strokeWidth={1.75} />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group flex items-start gap-2 min-w-0 text-left w-full py-1 px-1 -mx-1 rounded-[6px] hover:bg-surface-hover transition-colors"
      title="Edit"
    >
      {icon && <span className="mt-0.5 text-text-dim shrink-0">{icon}</span>}
      <div className="flex-1 min-w-0">
        {size !== "lg" && (
          <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim mb-0.5">
            {label}
          </div>
        )}
        <div
          className={`${titleCls} truncate ${isEmpty ? "text-text-faint" : ""}`}
        >
          {isEmpty ? placeholder : displayText}
        </div>
      </div>
      <Pencil size={12} strokeWidth={1.75} className="mt-1.5 text-text-faint opacity-0 group-hover:opacity-100 shrink-0" />
    </button>
  );
}
