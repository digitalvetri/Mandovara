"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Upload, Play } from "lucide-react";
import {
  backfillCatalogPdfs,
  uploadMissingCatalogPdf,
  listBackfillPlan,
} from "@/modules/admin/backfill-catalog-pdfs";
import type { BackfillReport, BackfillPlan } from "@/modules/admin/backfill-catalog-pdfs-types";

type Plan = BackfillPlan;

export function BackfillForm({ initialPlan }: { initialPlan: Plan }) {
  const [plan, setPlan] = useState<Plan>(initialPlan);
  const [uploading, startUpload] = useTransition();
  const [running, startRun] = useTransition();
  const [uploadResult, setUploadResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [report, setReport] = useState<BackfillReport | null>(null);

  async function refresh() {
    const fresh = await listBackfillPlan();
    setPlan(fresh);
  }

  function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setUploadResult(null);
    startUpload(async () => {
      const r = await uploadMissingCatalogPdf(fd);
      setUploadResult({
        ok:  r.ok,
        msg: r.ok ? `Uploaded ${r.slug}` : r.error ?? "Upload failed",
      });
      if (r.ok) {
        form.reset();
        await refresh();
      }
    });
  }

  function run() {
    setReport(null);
    startRun(async () => {
      const r = await backfillCatalogPdfs();
      setReport(r);
      await refresh();
    });
  }

  const missingOnDisk = plan.brands.flatMap((b) =>
    b.entries.filter((e) => !e.onDisk).map((e) => ({ ...e, brand: b.brand })),
  );

  return (
    <div className="max-w-[720px] mx-auto space-y-5 pb-10">
      {/* ── Section 1 · Optional file upload for anything still missing on disk ── */}
      {missingOnDisk.length > 0 && (
        <div className="rounded-[14px] border border-rule bg-surface p-5">
          <div className="flex items-start gap-3 mb-4">
            <Upload size={18} className="text-text shrink-0 mt-0.5" />
            <div>
              <div className="font-display text-[15px] font-semibold text-text mb-1">
                Step 1 — Upload the {missingOnDisk.length === 1 ? "one PDF" : `${missingOnDisk.length} PDFs`} still missing on the server
              </div>
              <div className="text-[12px] text-text-dim leading-relaxed">
                Download the file from the Drive folder, then pick which brand file it is and upload. The server will
                save it under the correct filename automatically.
              </div>
            </div>
          </div>

          <form onSubmit={upload} className="space-y-3">
            <label className="block">
              <div className="mb-1.5 text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                Which file is this?
              </div>
              <select
                name="slug"
                required
                defaultValue=""
                className="w-full h-[36px] px-3 rounded-[8px] border border-rule bg-surface text-[13px] outline-none focus:border-text"
              >
                <option value="" disabled>Choose the target…</option>
                {missingOnDisk.map((m) => (
                  <option key={m.slug} value={m.slug}>
                    {m.brand} — {m.orig}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="mb-1.5 text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                PDF file (max 200 MB)
              </div>
              <input
                type="file"
                name="pdf"
                accept="application/pdf,.pdf"
                required
                className="w-full text-[12.5px] file:mr-3 file:px-3 file:py-1.5 file:rounded-[6px] file:border file:border-rule file:bg-surface file:text-text file:cursor-pointer"
              />
            </label>

            <button
              type="submit"
              disabled={uploading}
              className="h-[36px] px-4 rounded-[8px] bg-text text-surface text-[13px] font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {uploading ? <><Loader2 size={14} className="animate-spin" /> Uploading…</> : <><Upload size={14} /> Upload PDF</>}
            </button>
          </form>

          {uploadResult && (
            <div
              className={`mt-3 rounded-[8px] p-3 border text-[12.5px] flex items-start gap-2 ${
                uploadResult.ok ? "border-solid/40 bg-solid/5 text-solid" : "border-fault/40 bg-fault/5 text-fault"
              }`}
            >
              {uploadResult.ok ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" /> : <AlertTriangle size={13} className="shrink-0 mt-0.5" />}
              <div>{uploadResult.msg}</div>
            </div>
          )}
        </div>
      )}

      {/* ── Section 2 · Preview + one-click backfill ─────────────────────── */}
      <div className="rounded-[14px] border border-rule bg-surface p-5">
        <div className="flex items-start gap-3 mb-4">
          <Play size={18} className="text-text shrink-0 mt-0.5" />
          <div>
            <div className="font-display text-[15px] font-semibold text-text mb-1">
              Step {missingOnDisk.length > 0 ? "2" : "1"} — Register missing collections in the database
            </div>
            <div className="text-[12px] text-text-dim leading-relaxed">
              For every PDF on the server, creates the matching Collection row under Platinum Range or Ready Stock if
              it doesn’t exist yet. Files that are still missing on disk will be skipped and shown below. This is
              safe to run repeatedly.
            </div>
          </div>
        </div>

        {plan.ok && (
          <div className="mb-4 space-y-3">
            {plan.brands.map((b) => {
              const toDo     = b.entries.filter((e) => e.onDisk && !e.registered && !e.conflictWith);
              const conflict = b.entries.filter((e) => e.conflictWith);
              const missing  = b.entries.filter((e) => !e.onDisk);
              return (
                <div key={b.brand} className="rounded-[10px] border border-rule/60 p-3">
                  <div className="text-[13px] font-medium text-text mb-1">{b.brand}</div>
                  <div className="text-[11.5px] text-text-dim">
                    {toDo.length === 0 && missing.length === 0 && conflict.length === 0 && "Nothing to do — all collections registered."}
                    {toDo.length > 0 && (<><strong className="text-text">{toDo.length}</strong> to register</>)}
                    {toDo.length > 0 && (conflict.length > 0 || missing.length > 0) && " · "}
                    {conflict.length > 0 && (<><strong className="text-gold">{conflict.length}</strong> already in another brand (will skip)</>)}
                    {conflict.length > 0 && missing.length > 0 && " · "}
                    {missing.length > 0 && (<><strong className="text-fault">{missing.length}</strong> file{missing.length === 1 ? "" : "s"} still missing on disk</>)}
                  </div>

                  {conflict.length > 0 && (
                    <ul className="mt-2 text-[11px] text-text-dim space-y-0.5 pl-3">
                      {conflict.map((c) => (
                        <li key={c.slug}>· <strong className="text-text">{c.name}</strong> ({c.slug}) — already in <em>{c.conflictWith}</em></li>
                      ))}
                    </ul>
                  )}

                  {b.orphans.length > 0 && (
                    <div className="mt-3 text-[11px] text-text-dim">
                      <div className="text-fault mb-1">
                        {b.orphans.length} existing collection{b.orphans.length === 1 ? "" : "s"} in this brand point to a PDF that isn’t on disk:
                      </div>
                      <ul className="pl-3 space-y-0.5">
                        {b.orphans.map((o) => (
                          <li key={o.id}>· <strong className="text-text">{o.name}</strong> → {o.catalogPdfKey}</li>
                        ))}
                      </ul>
                      <div className="mt-1">These are old rows from a previous import. Clean up manually from the products page if you want them gone.</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={run}
          disabled={running}
          className="h-[38px] w-full rounded-[8px] bg-text text-surface text-[13px] font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {running ? <><Loader2 size={14} className="animate-spin" /> Registering…</> : <><Play size={14} /> Register missing collections</>}
        </button>
      </div>

      {/* ── Section 3 · Result ───────────────────────────────────────────── */}
      {report && (
        <div
          className={`rounded-[14px] p-5 border ${
            report.ok ? "border-solid/40 bg-solid/5" : "border-fault/40 bg-fault/5"
          }`}
        >
          <div className="flex items-start gap-2 mb-3">
            {report.ok
              ? <CheckCircle2 size={16} className="text-solid shrink-0 mt-0.5" />
              : <AlertTriangle size={16} className="text-fault shrink-0 mt-0.5" />}
            <div className="font-display text-[15px] font-semibold text-text">
              {report.ok ? "Done" : "Failed"}
            </div>
          </div>

          {report.error && (
            <div className="text-[12.5px] text-fault mb-3 font-mono">{report.error}</div>
          )}

          {report.ok && (
            <>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-[8px] border border-rule bg-surface p-3">
                  <div className="text-[10.5px] uppercase tracking-[0.12em] text-text-dim">Platinum Range now has</div>
                  <div className="text-[22px] font-display font-semibold text-text tabular">{report.finalCounts.platinum} PDFs</div>
                </div>
                <div className="rounded-[8px] border border-rule bg-surface p-3">
                  <div className="text-[10.5px] uppercase tracking-[0.12em] text-text-dim">Ready Stock now has</div>
                  <div className="text-[22px] font-display font-semibold text-text tabular">{report.finalCounts.readyStock} PDFs</div>
                </div>
              </div>

              <ResultList title={`Created (${report.created.length})`} items={report.created} tone="solid" />
              <ResultList title={`Updated (${report.updated.length})`} items={report.updated} tone="text" />
              <ResultList title={`Already registered (${report.unchanged.length})`} items={report.unchanged} tone="dim" />
              {report.skippedConflict.length > 0 && (
                <div className="mt-3 rounded-[8px] border border-gold/40 bg-gold/5 p-3">
                  <div className="text-[12.5px] font-medium text-gold mb-2">
                    Skipped — PDF already used by another brand ({report.skippedConflict.length})
                  </div>
                  <ul className="text-[11.5px] text-text space-y-0.5">
                    {report.skippedConflict.map((c) => (
                      <li key={`${c.brand}:${c.slug}`}>
                        · would have been <strong>{c.brand} — {c.name}</strong>, but <em>{c.ownedBy}</em> already owns <code>{c.slug}</code>
                      </li>
                    ))}
                  </ul>
                  <div className="text-[11px] text-text-dim mt-2">
                    To register these under this brand too, first remove the PDF from the other brand on the products page.
                  </div>
                </div>
              )}
              {report.missingOnDisk.length > 0 && (
                <div className="mt-3 rounded-[8px] border border-fault/40 bg-fault/5 p-3">
                  <div className="text-[12.5px] font-medium text-fault mb-2">
                    Skipped — file still missing on disk ({report.missingOnDisk.length})
                  </div>
                  <ul className="text-[11.5px] text-fault space-y-0.5">
                    {report.missingOnDisk.map((m) => (
                      <li key={m.slug}>· {m.brand} — {m.orig} → needs {m.slug}</li>
                    ))}
                  </ul>
                  <div className="text-[11px] text-text-dim mt-2">Upload each one above and re-run.</div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ResultList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "solid" | "text" | "dim";
}) {
  if (items.length === 0) return null;
  const toneClass =
    tone === "solid" ? "text-solid"
    : tone === "text" ? "text-text"
    : "text-text-dim";
  return (
    <div className="mb-2">
      <div className={`text-[11.5px] font-medium ${toneClass} mb-1`}>{title}</div>
      <ul className="text-[11.5px] text-text-dim space-y-0.5 pl-3">
        {items.map((i) => <li key={i}>· {i}</li>)}
      </ul>
    </div>
  );
}
