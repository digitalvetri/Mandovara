"use client";

// Contacts on the Client 360 page — now with a way to add one.
//
// The old block listed `client.contacts` and nothing else: no button, no
// form, and an empty state that just said "No contact persons." with no
// hint that anything could be done about it. The owner asked for the
// section to move up the page and for the buttons to stop looking like
// an afterthought, so the card leads with the people and puts one clear
// action beside the heading.

import { useState, useTransition } from "react";
import { Plus, Phone, Mail, Trash2, X } from "lucide-react";
import { addClientContact, deleteClientContact } from "@/modules/clients/actions-contact";

export interface ContactRow {
  id:          string;
  name:        string;
  designation: string | null;
  mobile:      string;
  email:       string | null;
}

interface Props {
  clientId:  string;
  contacts:  ContactRow[];
  canCreate: boolean;
  canDelete: boolean;
}

export function ContactsCard({ clientId, contacts, canCreate, canDelete }: Props) {
  const [open, setOpen]     = useState(false);
  const [name, setName]     = useState("");
  const [role, setRole]     = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail]   = useState("");
  const [error, setError]   = useState<string | null>(null);
  const [pending, start]    = useTransition();

  function reset() {
    setName(""); setRole(""); setMobile(""); setEmail(""); setError(null);
  }

  function submit() {
    setError(null);
    start(async () => {
      const r = await addClientContact({
        clientId,
        name:   name.trim(),
        mobile: mobile.trim(),
        ...(role.trim()  && { designation: role.trim() }),
        ...(email.trim() && { email: email.trim() }),
      });
      if (!r.ok) {
        // Field errors are more use spelled out than as red outlines on
        // a four-field form.
        const detail = r.fieldErrors
          ? Object.values(r.fieldErrors).join(" ")
          : null;
        setError(detail ?? r.error ?? "Could not save that contact.");
        return;
      }
      reset();
      setOpen(false);
    });
  }

  function remove(id: string) {
    start(async () => { await deleteClientContact({ id }); });
  }

  return (
    <div className="rounded-[14px] border border-rule bg-surface p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-text">
          Contacts{contacts.length > 0 && (
            <span className="ml-1.5 text-[13px] font-normal text-text-dim">
              ({contacts.length})
            </span>
          )}
        </h2>
        {canCreate && (
          <button
            type="button"
            onClick={() => { setOpen((v) => !v); setError(null); }}
            className="inline-flex h-[34px] items-center gap-1.5 rounded-[6px] border border-accent/40 bg-accent/10 px-3.5 text-[13px] font-medium text-accent transition-colors hover:bg-accent/20"
          >
            {open ? <X size={14} /> : <Plus size={14} />}
            {open ? "Cancel" : "Add contact"}
          </button>
        )}
      </div>

      {open && canCreate && (
        <div className="mb-4 rounded-[10px] border border-rule bg-surface-2/50 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Name" value={name} onChange={setName} placeholder="Priya Raman" />
            <Field label="Role" value={role} onChange={setRole} placeholder="Site engineer (optional)" />
            <Field label="Mobile" value={mobile} onChange={setMobile} placeholder="+91 98765 43210" />
            <Field label="Email" value={email} onChange={setEmail} placeholder="Optional" />
          </div>
          {error && <p className="mt-3 text-[13px] text-heat" role="alert">{error}</p>}
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="inline-flex h-[34px] items-center rounded-[6px] bg-accent px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save contact"}
            </button>
            <button
              type="button"
              onClick={() => { reset(); setOpen(false); }}
              className="inline-flex h-[34px] items-center rounded-[6px] border border-rule px-4 text-[13px] text-text-dim transition-colors hover:text-text"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {contacts.length === 0 ? (
        <p className="text-[13.5px] text-text-dim">
          No contact people yet.
          {canCreate && " Use “Add contact” to save the person you actually speak to."}
        </p>
      ) : (
        <ul className="divide-y divide-rule/60">
          {contacts.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <div className="text-[14px] font-medium text-text">{c.name}</div>
                {c.designation && (
                  <div className="mt-0.5 text-[13px] text-text-dim">{c.designation}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`tel:${c.mobile.replace(/\s+/g, "")}`}
                  className="inline-flex h-[32px] items-center gap-1.5 rounded-[6px] border border-rule px-3 text-[13px] tabular-nums text-text-dim transition-colors hover:border-accent hover:text-text"
                >
                  <Phone size={12} />
                  {c.mobile}
                </a>
                {c.email && (
                  <a
                    href={`mailto:${c.email}`}
                    className="inline-flex h-[32px] items-center gap-1.5 rounded-[6px] border border-rule px-3 text-[13px] text-text-dim transition-colors hover:border-accent hover:text-text"
                  >
                    <Mail size={12} />
                    Email
                  </a>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => remove(c.id)}
                    disabled={pending}
                    aria-label={`Remove ${c.name}`}
                    className="inline-flex h-[32px] w-[32px] items-center justify-center rounded-[6px] border border-rule text-text-faint transition-colors hover:border-heat hover:text-heat disabled:opacity-50"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Field({
  label, value, onChange, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] text-text-dim">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-[38px] rounded-[6px] border border-rule bg-surface px-3 text-[14px] text-text outline-none transition-colors placeholder:text-text-faint focus:border-accent"
      />
    </label>
  );
}
