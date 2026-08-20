"use client";

import { Download } from "lucide-react";

interface Props {
  filename: string;
  rows: Record<string, string>[];
}

function toCSV(rows: Record<string, string>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    headers.map(escape).join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h] ?? "")).join(",")),
  ];
  return lines.join("\r\n");
}

export function CardDownloadButton({ filename, rows }: Props) {
  function download() {
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={download}
      title={`Download ${filename} as CSV`}
      className="inline-flex items-center gap-1 h-[24px] px-2 rounded-[5px] text-[10.5px] text-text-dim border border-rule hover:text-accent hover:border-accent/40 transition-colors"
    >
      <Download size={11} strokeWidth={2} />
      CSV
    </button>
  );
}
