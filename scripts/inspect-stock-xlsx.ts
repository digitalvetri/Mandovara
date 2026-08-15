// One-off: inspect the two spreadsheets the user handed us so we can
// decide how to import them. Prints sheet names, headers, row count,
// and the first 3 data rows per sheet.

import * as XLSX from "xlsx";

const FILES = [
  "c:/Users/Administrator/Downloads/product catalog/WALLAPPER STOCK LIST (2) (2) (4).xlsx",
  "c:/Users/Administrator/Downloads/product catalog/CATALOGUE LIST.xlsx",
];

for (const path of FILES) {
  console.log(`\n${"=".repeat(80)}\nFILE: ${path}\n${"=".repeat(80)}`);
  const wb = XLSX.readFile(path);
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName]!;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: null,
      raw: false,
    });
    console.log(`\n  ── Sheet: "${sheetName}" — ${rows.length} rows`);
    if (rows.length === 0) continue;
    const headers = Object.keys(rows[0]!);
    console.log(`  Headers (${headers.length}): ${headers.map((h) => JSON.stringify(h)).join(", ")}`);
    console.log(`  First 3 rows:`);
    for (const r of rows.slice(0, 3)) {
      console.log(`    ${JSON.stringify(r)}`);
    }
  }
}
