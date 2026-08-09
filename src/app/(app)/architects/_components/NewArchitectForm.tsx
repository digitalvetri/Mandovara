"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { createArchitect } from "@/modules/architects/actions";

export function NewArchitectForm() {
  const router = useRouter();
  const [pending, startT] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFE] = useState<Record<string, string>>({});

  const [code, setCode] = useState("");
  const [firmName, setFirmName] = useState("");
  const [contactName, setContactName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [pct, setPct] = useState("0");

  function submit() {
    setError(null); setFE({});
    startT(async () => {
      const res = await createArchitect({
        code, firmName, contactName, mobile,
        email: email.trim().length > 0 ? email : "",
        commissionPct: Number(pct) || 0,
      });
      if (!res.ok) {
        setError(res.error ?? "Failed");
        setFE(res.fieldErrors ?? {});
        return;
      }
      router.push(`/architects/${res.data!.id}` as Route);
      router.refresh();
    });
  }

  return (
    <div className="rounded-[14px] bg-surface border border-rule p-6 space-y-4">
      <Row label="Code" value={code} onChange={setCode} error={fieldErrors["code"]}
           placeholder="ARC-001" width={180} />
      <Row label="Firm name" value={firmName} onChange={setFirmName} error={fieldErrors["firmName"]}
           placeholder="Studio ABC Architects" />
      <Row label="Contact name" value={contactName} onChange={setContactName} error={fieldErrors["contactName"]}
           placeholder="Arch. R. Kumar" />
      <Row label="Mobile" value={mobile} onChange={setMobile} error={fieldErrors["mobile"]}
           placeholder="+91 98765 43210" width={220} />
      <Row label="Email (optional)" value={email} onChange={setEmail} error={fieldErrors["email"]}
           placeholder="firm@example.com" type="email" />
      <Row label="Commission %" value={pct} onChange={setPct} error={fieldErrors["commissionPct"]}
           placeholder="8" width={100} type="number" />

      {error && <div className="text-[12px] text-bad">{error}</div>}
      <div className="pt-2">
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="h-[36px] px-4 rounded-[8px] bg-accent text-white text-[13px] font-medium hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create architect"}
        </button>
      </div>
    </div>
  );
}

function Row({
  label, value, onChange, error, placeholder, width, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void;
  error?: string; placeholder?: string; width?: number; type?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">{label}</div>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={width ? { width } : undefined}
        className={`h-[38px] px-3 bg-white/60 border rounded-[8px] text-[12.5px] outline-none focus:border-accent transition-colors ${error ? "border-bad" : "border-rule"} ${width ? "" : "w-full"}`}
      />
      {error && <div className="mt-1 text-[10.5px] text-bad">{error}</div>}
    </label>
  );
}
