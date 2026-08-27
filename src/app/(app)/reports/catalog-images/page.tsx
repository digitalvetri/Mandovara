// Catalog image-coverage report — which SKUs still fall back to the
// hex swatch on /products because their Colourway has no imageKey.
//
// Owner uses this to decide which PDFs to prioritise dropping into
// c:/Users/.../product catalog/ before re-running
// scripts/build-catalog-images.ts.

import Link from "next/link";
import type { Route } from "next";
import { Topbar } from "@/components/layout/Topbar";
import { Pager } from "@/components/data/Pager";
import { devContext } from "@/lib/dev-context";
import { catalogImageCoverage } from "@/modules/catalog/image-coverage";
import { CoverageSearch } from "./_components/CoverageSearch";

export const dynamic = "force-dynamic";

interface SearchParams { q?: string; page?: string }

export default async function CatalogImagesReportPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ctx    = await devContext();

  const q    = params.q?.trim() ?? "";
  const page = parsePositiveInt(params.page) ?? 1;

  const r = await catalogImageCoverage(ctx, {
    ...(q && { search: q }),
    page,
    pageSize: 25,
  });

  const coveragePct = (r.coveragePct * 100).toFixed(1);
  const missingPct  = r.totalColourways === 0
    ? "0.0"
    : ((r.withoutImage / r.totalColourways) * 100).toFixed(1);

  return (
    <>
      <Topbar
        title="Catalog image coverage"
        eyebrow="Which SKUs still show the swatch fallback on /products"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Overall coverage ────────────────────────────────── */}
        <Card
          title="Overall coverage"
          eyebrow={`${r.totalColourways} SKUs total`}
          hero={`${coveragePct}%`}
          heroSub={`${r.withImage} with image · ${r.withoutImage} missing (${missingPct}%)`}
        >
          <div className="h-[10px] rounded-full bg-rule/60 overflow-hidden">
            <div
              className="h-full bg-good rounded-full"
              style={{ width: `${coveragePct}%` }}
            />
          </div>
          <p className="mt-3 text-[11.5px] text-text-dim leading-relaxed">
            Drop source PDFs into{" "}
            <span className="tabular text-text-faint">c:\Users\Administrator\Downloads\product catalog\</span>
            {" "}(any subfolder), then run{" "}
            <span className="tabular text-text-faint">pnpm tsx scripts/build-catalog-images.ts</span>
            {" "}to backfill.
          </p>
        </Card>

        {/* ── By product family ──────────────────────────────── */}
        <Card title="Missing by family" eyebrow={`${r.byFamily.length} famil${r.byFamily.length === 1 ? "y" : "ies"}`}>
          {r.byFamily.length === 0 ? (
            <Empty text="No colourways yet." />
          ) : (
            <ul className="divide-y divide-rule/60">
              {r.byFamily.map((b) => <Bar key={b.key} b={b} />)}
            </ul>
          )}
        </Card>

        {/* ── Worst-offender collections ─────────────────────── */}
        <Card
          title="Collections needing the most work"
          eyebrow="Top 10 by missing count"
        >
          {r.byCollection.length === 0 ? (
            <Empty text="Every collection has full coverage 🎉" />
          ) : (
            <ul className="divide-y divide-rule/60">
              {r.byCollection.map((b) => <Bar key={b.key} b={b} />)}
            </ul>
          )}
        </Card>

        {/* ── Sample of the missing list ─────────────────────── */}
        <Card
          title="Quick summary"
          eyebrow="Snapshot"
        >
          <dl className="text-[12.5px] space-y-2.5">
            <Row k="Total SKUs" v={String(r.totalColourways)} />
            <Row k="With cover image" v={String(r.withImage)} tone="good" />
            <Row k="Missing image" v={String(r.withoutImage)} tone={r.withoutImage > 0 ? "bad" : "muted"} />
            <Row k="Coverage" v={`${coveragePct}%`} />
            <Row k="Matches on this page" v={String(r.missingTotal)} />
          </dl>
        </Card>
      </div>

      {/* ── Missing SKU table ─────────────────────────────────── */}
      <section className="mt-6 pb-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
            Missing SKUs
          </h2>
          <div className="text-[11px] text-text-faint tabular">
            {q ? `${r.missingTotal} match${r.missingTotal === 1 ? "" : "es"}` : `${r.withoutImage} rows`}
          </div>
        </div>
        <CoverageSearch initialValue={q} />

        {r.missing.length === 0 ? (
          <div className="rounded-[14px] bg-surface border border-rule py-14 text-center">
            <div className="text-[13.5px] text-text mb-1">
              {q ? "No missing SKUs match that search." : "Every SKU has an image."}
            </div>
            <p className="text-[12px] text-text-dim">
              {q ? "Clear the search to see the full list." : "Great job."}
            </p>
          </div>
        ) : (
          <div className="rounded-[14px] bg-surface border border-rule overflow-x-auto">
            <table className="min-w-[480px] w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                  <Th>Swatch</Th>
                  <Th>Code</Th>
                  <Th>Design</Th>
                  <Th>Collection</Th>
                  <Th>Family</Th>
                </tr>
              </thead>
              <tbody>
                {r.missing.map((row) => (
                  <tr key={row.id} className="border-b border-rule/70 last:border-0 hover:bg-surface-hover transition-colors">
                    <Td>
                      <span
                        className="block h-7 w-7 rounded-[5px] border border-rule"
                        style={{ background: row.hex ?? "var(--color-surface-hover)" }}
                        aria-label={`${row.designName} swatch`}
                      />
                    </Td>
                    <Td>
                      <Link
                        href={`/products/${row.id}` as Route}
                        className="tabular text-text hover:text-accent"
                      >
                        {row.code}
                      </Link>
                    </Td>
                    <Td>
                      {row.designName}
                      <div className="text-[10.5px] text-text-faint">— {row.colourName}</div>
                    </Td>
                    <Td className="text-text-dim">
                      <span className="text-text-faint">{row.brand}</span> › {row.collection}
                    </Td>
                    <Td className="text-text-dim">{familyLabel(row.family)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pager page={r.page} pageSize={r.pageSize} total={r.missingTotal} />
      </section>
    </>
  );
}

// ── layout helpers ───────────────────────────────────────────────────

function Card({
  title, eyebrow, hero, heroSub, children,
}: {
  title:    string;
  eyebrow?: string;
  hero?:    string;
  heroSub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[14px] bg-surface border border-rule p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">{title}</div>
        {eyebrow && <div className="text-[10.5px] text-text-faint">{eyebrow}</div>}
      </div>
      {hero && (
        <div className="mb-3 pb-3 border-b border-rule/60">
          <div className="font-display text-[28px] leading-none font-semibold tabular text-text">{hero}</div>
          {heroSub && <div className="mt-1 text-[11px] text-text-dim">{heroSub}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

function Bar({ b }: { b: { key: string; label: string; total: number; missing: number; pct: number } }) {
  const pct = (b.pct * 100).toFixed(0);
  const barColour = b.pct >= 0.75 ? "bg-bad" : b.pct >= 0.5 ? "bg-heat" : "bg-good";
  return (
    <li className="py-2 flex items-center gap-3">
      <div className="w-[140px] text-[12px] text-text truncate" title={b.label}>{b.label}</div>
      <div className="flex-1">
        <div className="h-[6px] rounded-full bg-rule/60 overflow-hidden">
          <div className={`h-full rounded-full ${barColour}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="w-[64px] text-right tabular text-[11.5px] text-text-dim">
        <span className={b.missing > 0 ? "text-text" : ""}>{b.missing}</span>/<span>{b.total}</span>
      </div>
      <div className="w-[44px] text-right tabular text-[11.5px] text-text-dim">
        {pct}%
      </div>
    </li>
  );
}

function Row({ k, v, tone }: { k: string; v: string; tone?: "good" | "bad" | "muted" }) {
  const cls =
    tone === "good" ? "text-good" :
    tone === "bad"  ? "text-bad"  :
    tone === "muted" ? "text-text-dim" : "text-text";
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-dim text-[11.5px]">{k}</dt>
      <dd className={`text-right tabular ${cls}`}>{v}</dd>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="py-6 text-center text-[12px] text-text-faint">{text}</div>;
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 h-[34px] font-medium text-left">{children}</th>;
}
function Td({
  children, className = "",
}: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2 text-left ${className}`}>{children}</td>;
}

function parsePositiveInt(v: string | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}

const FAMILY_LABEL: Record<string, string> = {
  CURTAIN_FABRIC: "Curtain fabric",
  SHEER: "Sheer",
  LINING: "Lining",
  BLIND: "Blind",
  WALLPAPER: "Wallpaper",
  FLOORING: "Flooring",
  CARPET_ROLL: "Carpet roll",
  CARPET_TILE: "Carpet tile",
  UPHOLSTERY_FABRIC: "Upholstery fabric",
  FOAM_FILLING: "Foam filling",
  VERTICAL_GARDEN: "Vertical garden",
  INTERIOR_FILM: "Interior film",
  MURAL: "Mural",
  HARDWARE_TRACK: "Hardware — track",
  HARDWARE_ROD: "Hardware — rod",
  MOTOR: "Motor",
  ACCESSORY: "Accessory",
  SERVICE: "Service",
};

function familyLabel(f: string): string {
  return FAMILY_LABEL[f] ?? f;
}
