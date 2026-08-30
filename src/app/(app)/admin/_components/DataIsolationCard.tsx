// Whether tenant isolation is actually switched on, said out loud.
//
// The container logs this at every start and has done all along; a log line
// is not a place anyone looks. Shown here it is checkable in three seconds,
// and it flips to green by itself once APP_DATABASE_URL is configured — so
// the operator can confirm the fix rather than assume it.
//
// Deliberately shown in both states. A card that only appears when something
// is wrong teaches you nothing when it is absent: you cannot tell "enforced"
// from "the check is broken".

import { ShieldCheck, ShieldAlert } from "lucide-react";
import type { RlsStatus } from "@/kernel/db/rls-status";

export function DataIsolationCard({ status }: { status: RlsStatus }) {
  const ok = status.enforced;

  return (
    <div className="rounded-[14px] border border-rule bg-surface p-5 sm:p-6">
      <div className="flex items-center gap-2">
        {ok
          ? <ShieldCheck size={14} strokeWidth={1.8} className="text-good" />
          : <ShieldAlert size={14} strokeWidth={1.8} className="text-bad" />}
        <div className="font-display text-[18px] font-semibold">Data isolation</div>
      </div>

      <p className="mt-2 text-[12.5px] text-text-dim">
        {ok ? (
          <>
            Enforced. The app connects as{" "}
            <span className="text-text">{status.role}</span>, which cannot see
            another organisation&rsquo;s rows even if a query forgets to ask.
          </>
        ) : status.error ? (
          <>Could not check: {status.error}</>
        ) : (
          <>
            <span className="text-bad">Not enforced.</span> The app connects as{" "}
            <span className="text-text">{status.role}</span>, which bypasses row
            security — every isolation policy is currently decorative.
          </>
        )}
      </p>

      {!ok && !status.error && (
        <div className="mt-3 rounded-[8px] border-l-2 border-bad bg-bad/8 px-3 py-2.5">
          <p className="text-[11.5px] text-text">
            Set these two in the deployment environment and redeploy — the container
            creates the restricted role on start:
          </p>
          <ul className="mt-1.5 space-y-1 text-[11px] text-text-dim">
            <li>
              <span className="font-medium text-text">APP_DB_PASSWORD</span> — a new
              password (<span className="tabular">openssl rand -hex 24</span>)
            </li>
            <li>
              <span className="font-medium text-text">APP_DATABASE_URL</span> — the same
              host, port and database as DATABASE_URL, with user{" "}
              <span className="tabular">mandovara_app</span> and that password
            </li>
          </ul>
          <p className="mt-2 text-[11px] text-text-dim">
            Leave DATABASE_URL pointing at the owner: migrations, the seed and the
            sign-in lookup all need it.
          </p>
        </div>
      )}
    </div>
  );
}
