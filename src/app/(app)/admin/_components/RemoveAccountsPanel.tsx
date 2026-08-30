"use client";

// "Remove the accounts I didn't add" — for the owner, in the app.
//
// The same job as the token-gated /api/admin/prune-users route, minus the
// terminal. Deliberately three states rather than one button: idle asks,
// preview shows exactly who goes, and only then is there anything to
// confirm. A destructive action whose consequences you read first is a
// different thing from one you agree to blind.
//
// Owner, 2026-08-30, on the curl version: the names in the lead and
// site-visit dropdowns are the seeded demo staff, and they go when the
// accounts go.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, Users, AlertTriangle } from "lucide-react";
import {
  previewAccountCleanup, removeOtherAccounts, type CleanupPreview,
} from "@/modules/admin/actions-prune";

export function RemoveAccountsPanel() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<CleanupPreview | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function look() {
    setError(null); setDone(null);
    start(async () => {
      const res = await previewAccountCleanup();
      if (!res.ok || !res.data) { setError(res.error ?? "Could not read the accounts."); return; }
      setPreview(res.data);
    });
  }

  function commit() {
    setError(null);
    start(async () => {
      const res = await removeOtherAccounts();
      if (!res.ok || !res.data) { setError(res.error ?? "Could not remove the accounts."); return; }
      setPreview(null);
      setDone(
        `Removed ${res.data.accountsRemoved} account${res.data.accountsRemoved === 1 ? "" : "s"}` +
        ` and ${res.data.staffRemoved} staff record${res.data.staffRemoved === 1 ? "" : "s"}.`,
      );
      router.refresh();
    });
  }

  const nothingToDo = preview !== null && preview.accounts.length === 0 && preview.staff.length === 0;

  return (
    <div className="border-t border-rule px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-[60%]">
          <div className="flex items-center gap-2">
            <Users size={13} strokeWidth={1.75} className="text-text-dim" />
            <div className="text-[13px] font-medium text-text">Remove accounts you didn&apos;t add</div>
          </div>
          <p className="mt-1 max-w-[62ch] text-[12px] text-text-dim">
            Deletes every sign-in except your own, and the staff records that go with
            them. This is where the names in the lead and site-visit assignment lists
            come from. You will see exactly who before anything happens.
          </p>
        </div>
        {preview === null && (
          <button
            type="button"
            onClick={look}
            disabled={pending}
            className="inline-flex h-[30px] items-center gap-1.5 rounded-[6px] border border-rule px-3 text-[11.5px] font-medium text-text-dim transition-colors hover:border-fault/40 hover:text-fault disabled:opacity-50"
          >
            {pending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            Show what would be removed
          </button>
        )}
      </div>

      {done && <p className="mt-3 text-[12px] text-good">{done}</p>}
      {error && <p className="mt-3 text-[12px] text-fault">{error}</p>}

      {preview && (
        <div className="mt-4 rounded-[10px] border border-rule bg-surface-2 p-4">
          <p className="text-[12px] text-text">
            Keeping <span className="font-medium">{preview.keeping.name}</span>
            {preview.keeping.email && (
              <span className="text-text-dim"> · {preview.keeping.email}</span>
            )}
            <span className="text-text-dim"> — the account you are signed in as.</span>
          </p>

          {nothingToDo ? (
            <p className="mt-3 text-[12px] text-text-dim">
              Nothing to remove. Yours is the only account, and every staff record
              belongs to it.
            </p>
          ) : (
            <>
              {preview.accounts.length > 0 && (
                <div className="mt-3">
                  <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                    Sign-ins to delete · {preview.accounts.length}
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {preview.accounts.map((a) => (
                      <li key={a.id} className="text-[12px] text-text">
                        {a.name}
                        <span className="text-text-dim">
                          {a.email ? ` · ${a.email}` : ""} · {a.role.replace(/_/g, " ").toLowerCase()}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {preview.staff.length > 0 && (
                <div className="mt-3">
                  <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                    Staff records to delete · {preview.staff.length}
                  </div>
                  <p className="mt-1.5 text-[12px] text-text-dim">
                    {preview.staff.map((s) => `${s.code} ${s.name}`).join(", ")}
                  </p>
                </div>
              )}

              <div className="mt-3 flex items-start gap-1.5 rounded-[8px] border-l-2 border-warn bg-warn/8 px-3 py-2">
                <AlertTriangle size={12} className="mt-[2px] shrink-0 text-warn" />
                <p className="text-[11.5px] text-text">
                  This cannot be undone. Work these people already recorded —
                  quotations, visits, invoices — stays where it is; the audit log will
                  show it against &ldquo;Removed account&rdquo;.
                </p>
              </div>
            </>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {!nothingToDo && (
              <button
                type="button"
                onClick={commit}
                disabled={pending}
                className="inline-flex h-[30px] items-center gap-1.5 rounded-[6px] bg-fault px-3 text-[11.5px] font-medium text-white transition-colors hover:bg-fault/90 disabled:opacity-50"
              >
                {pending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Delete these permanently
              </button>
            )}
            <button
              type="button"
              onClick={() => { setPreview(null); setError(null); }}
              disabled={pending}
              className="h-[30px] px-3 text-[11.5px] text-text-dim transition-colors hover:text-text disabled:opacity-50"
            >
              {nothingToDo ? "Close" : "Cancel"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
