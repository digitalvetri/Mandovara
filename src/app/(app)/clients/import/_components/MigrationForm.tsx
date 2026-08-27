"use client";

// Bringing the client's existing books in.
//
// Written for someone doing this once, under pressure, with a
// spreadsheet they did not design. So: the template comes first, the
// rules are stated before the file picker rather than after a failure,
// and every rejected row is reported with its sheet, row number and the
// reason in plain words — never "validation failed".

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Upload, Download, CheckCircle2, AlertTriangle, Loader2, FileSpreadsheet,
} from "lucide-react";
import { importClientsAndProjects, type MigrationResult } from "@/modules/clients/import-action";

export function MigrationForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit(file: File): void {
    setError(null);
    setResult(null);
    setFileName(file.name);
    start(async () => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await importClientsAndProjects(fd);
      if (!res.ok || !res.data) { setError(res.error ?? "The import failed."); return; }
      setResult(res.data);
      router.refresh();
    });
  }

  return (
    <div className="max-w-[760px] space-y-4 pb-10">

      {/* ── What to send ── */}
      <section className="rounded-[14px] border border-rule bg-surface p-5">
        <h2 className="text-[14px] font-semibold text-text">Start with the template</h2>
        <p className="mt-1.5 max-w-[62ch] text-[13px] text-text-dim">
          One workbook, two sheets — <strong>Clients</strong> and <strong>Projects</strong>.
          Column names are matched loosely, so &ldquo;Client Name&rdquo;, &ldquo;client_name&rdquo;
          and &ldquo;CUSTOMER NAME&rdquo; all work. Fill in what you have and leave the rest blank.
        </p>
        <a
          href="/api/clients/import-template"
          className="mt-3 inline-flex h-9 items-center gap-2 rounded-[8px] border border-rule px-4 text-[12.5px] font-medium text-text transition-colors hover:border-accent"
        >
          <Download size={13} strokeWidth={1.9} />
          Download the template
        </a>

        <dl className="mt-4 grid gap-x-6 gap-y-2 border-t border-rule pt-4 text-[12.5px] sm:grid-cols-2">
          <Rule k="Mobile number" v="Required on every client — it is how clients are matched and how duplicates are avoided. 10 digits, with or without +91." />
          <Rule k="Client reference" v="Each project needs client_code or the client's mobile, matching a row in the Clients sheet." />
          <Rule k="Amounts" v="150000, 1,50,000, ₹1,50,000 or 1.5L all read the same." />
          <Rule k="Dates" v="dd/mm/yyyy — 03/04/2026 is 3 April." />
          <Rule k="Re-uploading" v="Safe. Clients are matched on mobile, so a corrected file updates them instead of creating duplicates." />
          <Rule k="Partial success" v="Good rows are saved even if others fail. Fix the listed rows and upload again." />
        </dl>
      </section>

      {/* ── Upload ── */}
      <section className="rounded-[14px] border border-rule bg-surface p-5">
        <h2 className="text-[14px] font-semibold text-text">Upload your file</h2>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) submit(f); }}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => fileRef.current?.click()}
            className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-accent px-5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} strokeWidth={1.9} />}
            {pending ? "Importing…" : "Choose Excel file"}
          </button>
          {fileName && (
            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-text-dim">
              <FileSpreadsheet size={13} />
              {fileName}
            </span>
          )}
        </div>
        {pending && (
          <p className="mt-2.5 text-[12px] text-text-dim">
            A thousand clients takes a minute or so — leave this page open.
          </p>
        )}
        {error && (
          <div className="mt-3 rounded-[8px] border-l-2 border-bad bg-bad/8 px-3.5 py-2.5 text-[12.5px] text-text">
            {error}
          </div>
        )}
      </section>

      {/* ── Result ── */}
      {result && (
        <section className="overflow-hidden rounded-[14px] border border-rule bg-surface">
          <div className="border-b border-rule px-5 py-4">
            <div className="flex items-center gap-2">
              {result.errors.length === 0
                ? <CheckCircle2 size={16} className="text-good" />
                : <AlertTriangle size={16} className="text-warn" />}
              <h2 className="text-[14px] font-semibold text-text">
                {result.errors.length === 0 ? "Import complete" : "Imported, with rows to fix"}
              </h2>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-rule bg-rule sm:grid-cols-4">
              <Stat k="Clients added"   v={result.clientsCreated} tone="text-good" />
              <Stat k="Clients updated" v={result.clientsUpdated} />
              <Stat k="Projects added"  v={result.projectsCreated} tone="text-good" />
              <Stat k="Rows to fix"     v={result.errors.length} tone={result.errors.length > 0 ? "text-warn" : "text-text"} />
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="max-h-[420px] overflow-y-auto">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse">
                  <thead className="sticky top-0">
                    <tr className="border-b border-rule bg-surface-2">
                      <Th>Sheet</Th><Th>Row</Th><Th>Column</Th><Th>What to fix</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((e, i) => (
                      <tr key={i} className="border-b border-rule/60 last:border-0">
                        <td className="px-4 py-2 text-[12px] text-text-dim">{e.sheet}</td>
                        <td className="tabular px-4 py-2 text-[12px] text-text">{e.row || "—"}</td>
                        <td className="px-4 py-2 text-[12px] text-text-dim">{e.field}</td>
                        <td className="px-4 py-2 text-[12.5px] text-text">{e.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="border-t border-rule px-5 py-3 text-[12px] text-text-dim">
            {result.errors.length === 0
              ? "Everything in the file is now in the system."
              : "Correct the rows above in your spreadsheet and upload it again — what already came in will be updated, not duplicated."}
          </div>
        </section>
      )}
    </div>
  );
}

function Rule({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="font-medium text-text">{k}</dt>
      <dd className="text-text-dim">{v}</dd>
    </div>
  );
}

function Stat({ k, v, tone = "text-text" }: { k: string; v: number; tone?: string }) {
  return (
    <div className="bg-surface-2 px-3.5 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.12em] text-text-dim">{k}</div>
      <div className={`tabular mt-1 text-[17px] font-medium ${tone}`}>{v.toLocaleString("en-IN")}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-text-dim">
      {children}
    </th>
  );
}
