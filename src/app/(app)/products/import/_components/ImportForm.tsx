"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, CheckCircle2, AlertTriangle, Loader2, FileSpreadsheet } from "lucide-react";
import { importDesigns, type ImportResult } from "@/modules/catalog/import-action";

export function ImportForm() {
  const router = useRef(useRouter()).current;
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setFileName(f?.name ?? null);
    setError(null);
    setResult(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Choose an Excel file first."); return; }

    const fd = new FormData();
    fd.set("file", file);

    start(async () => {
      const res = await importDesigns(fd);
      if (!res.ok) { setError(res.error ?? "Import failed."); return; }
      setResult(res.data ?? null);
      if ((res.data?.imported ?? 0) > 0) router.refresh();
    });
  }

  return (
    <div className="rounded-[14px] bg-surface border border-rule p-5 space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <div className="mb-1.5 text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
            Excel workbook (.xlsx or .xls)
          </div>
          <div className="flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              id="import-file"
              onChange={handleFileChange}
            />
            <label
              htmlFor="import-file"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-[8px] text-[12.5px] font-medium text-text-dim border border-rule hover:text-accent hover:border-accent/50 cursor-pointer transition-colors"
            >
              <FileSpreadsheet size={14} strokeWidth={1.75} />
              {fileName ? "Change file" : "Choose file"}
            </label>
            {fileName && (
              <span className="text-[12px] text-text truncate max-w-[320px]" title={fileName}>
                {fileName}
              </span>
            )}
          </div>
        </label>

        <button
          type="submit"
          disabled={pending || !fileName}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-[8px] text-[13px] font-semibold bg-accent text-ink hover:bg-accent/85 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {pending ? <><Loader2 size={14} className="animate-spin" /> Importing…</>
                   : <><Upload size={14} strokeWidth={2} /> Import designs</>}
        </button>
      </form>

      {error && (
        <div className="rounded-[10px] p-4 border border-fault/40 bg-fault/5 text-fault flex items-start gap-2 text-[13px]">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className={`rounded-[10px] p-4 border flex items-start gap-2.5 text-[13px] ${
            result.imported > 0
              ? "border-solid/40 bg-solid/5 text-solid"
              : "border-fault/40 bg-fault/5 text-fault"
          }`}>
            {result.imported > 0
              ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
              : <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            }
            <div className="flex-1">
              <div className="font-medium">
                Imported {result.imported} design{result.imported === 1 ? "" : "s"}
                {result.skippedDuplicates > 0 && ` · Skipped ${result.skippedDuplicates} duplicate${result.skippedDuplicates === 1 ? "" : "s"}`}
              </div>
              {result.errors.length > 0 && (
                <div className="text-[11.5px] text-text-dim mt-0.5">
                  {result.errors.length} row{result.errors.length === 1 ? "" : "s"} rejected — see details below.
                </div>
              )}
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="overflow-x-auto rounded-[8px] border border-rule">
              <table className="w-full text-[11.5px]">
                <thead className="bg-ink/20 text-text-dim uppercase tracking-[0.06em] text-[10px]">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium w-14">Row</th>
                    <th className="text-left px-3 py-2 font-medium w-36">Field</th>
                    <th className="text-left px-3 py-2 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule/60 [&_td]:px-3 [&_td]:py-2">
                  {result.errors.map((e, i) => (
                    <tr key={i}>
                      <td className="font-mono text-text-dim tabular">{e.row}</td>
                      <td className="font-mono text-text">{e.field}</td>
                      <td className="text-text">{e.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
