"use client";

// Edit Profile — the fields a person owns.
//
// Mobile, email, emergency contact and the picture. Name, employee code,
// designation, department, joining date and role are deliberately absent:
// those are HR's record, and someone editing their own start date or job
// title is not a profile feature (owner asked for "basic fields like
// personal mobile number, email, and emergency contact details").

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, Loader2, Upload, Trash2 } from "lucide-react";
import { updateMyProfile } from "@/modules/profile/actions";

export interface EditableProfile {
  mobile: string;
  email:  string;
  emergencyName:     string;
  emergencyMobile:   string;
  emergencyRelation: string;
  avatarKey: string | null;
  hasEmployee: boolean;
}

export function EditProfileSheet({ initial }: { initial: EditableProfile }) {
  const router = useRouter();
  const [open, setOpen]   = useState(false);
  const [form, setForm]   = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start]  = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function set<K extends keyof EditableProfile>(k: K, v: EditableProfile[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function save() {
    setError(null);
    start(async () => {
      const r = await updateMyProfile({
        mobile: form.mobile,
        email:  form.email,
        emergencyName:     form.emergencyName,
        emergencyMobile:   form.emergencyMobile,
        emergencyRelation: form.emergencyRelation,
      });
      if (!r.ok) {
        setError(r.fieldErrors ? Object.values(r.fieldErrors).join(" ") : (r.error ?? "Could not save."));
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  async function upload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/profile/avatar", { method: "POST", body: fd });
      const json = await res.json() as { ok: boolean; avatarKey?: string; error?: string };
      if (!json.ok) { setError(json.error ?? "Could not upload that image."); return; }
      set("avatarKey", json.avatarKey ?? null);
      router.refresh();
    } catch {
      setError("Could not upload that image.");
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto() {
    setUploading(true);
    try {
      await fetch("/api/profile/avatar", { method: "DELETE" });
      set("avatarKey", null);
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setForm(initial); setOpen(true); setError(null); }}
        className="inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-[8px] bg-gold px-3.5 text-[13px] font-semibold text-ink transition-colors hover:bg-gold-strong"
      >
        <Pencil size={13} strokeWidth={2} />
        Edit Profile
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-4">
      <div className="max-h-[90vh] w-full max-w-[520px] overflow-y-auto rounded-[14px] border border-border bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-text">Edit profile</h2>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close"
                  className="rounded-[6px] p-1 text-text-muted hover:bg-surface-2 hover:text-text">
            <X size={16} />
          </button>
        </div>

        {/* Picture */}
        <div className="mb-5 flex items-center gap-4">
          <div className="h-[64px] w-[64px] shrink-0 overflow-hidden rounded-full border-2 border-gold/30 bg-gold/15">
            {form.avatarKey
              ? <img src={form.avatarKey} alt="" className="h-full w-full object-cover" />
              : <span className="grid h-full w-full place-items-center text-[11px] text-text-muted">No photo</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
            />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="inline-flex h-[32px] items-center gap-1.5 rounded-[6px] border border-border px-3 text-[12.5px] text-text-muted hover:text-text disabled:opacity-50">
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              {form.avatarKey ? "Change photo" : "Upload photo"}
            </button>
            {form.avatarKey && (
              <button type="button" onClick={() => void removePhoto()} disabled={uploading}
                      className="inline-flex h-[32px] items-center gap-1.5 rounded-[6px] border border-border px-3 text-[12.5px] text-fault hover:bg-fault/10 disabled:opacity-50">
                <Trash2 size={12} /> Remove
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Mobile" value={form.mobile} onChange={(v) => set("mobile", v)} />
          <Field label="Email"  value={form.email}  onChange={(v) => set("email", v)} placeholder="Optional" />
        </div>

        {form.hasEmployee && (
          <>
            <div className="mb-2 mt-5 text-[11px] uppercase tracking-[0.12em] text-text-muted">
              Emergency contact
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Name"     value={form.emergencyName}     onChange={(v) => set("emergencyName", v)} />
              <Field label="Mobile"   value={form.emergencyMobile}   onChange={(v) => set("emergencyMobile", v)} />
              <Field label="Relation" value={form.emergencyRelation} onChange={(v) => set("emergencyRelation", v)} placeholder="e.g. Spouse" />
            </div>
          </>
        )}

        {error && <p className="mt-4 text-[13px] text-fault" role="alert">{error}</p>}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)}
                  className="h-[34px] rounded-[6px] border border-border px-4 text-[13px] text-text-muted hover:text-text">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={pending}
                  className="inline-flex h-[34px] items-center gap-1.5 rounded-[6px] bg-gold px-4 text-[13px] font-semibold text-ink hover:bg-gold-strong disabled:opacity-50">
            {pending && <Loader2 size={13} className="animate-spin" />}
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] text-text-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-[36px] rounded-[6px] border border-border bg-surface-2 px-3 text-[13.5px] text-text outline-none focus:border-gold"
      />
    </label>
  );
}
