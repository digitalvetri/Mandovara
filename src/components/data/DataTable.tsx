"use client";

// <DataTable> — the shared list-screen grid for every module in the app.
//
// TRACK-B-CRAFT.md §6, §9 W6 gate:
//   "server-paginated against 3,000 seeded colourways; full keyboard
//    nav; all four states." Loading / empty / error are rendered by the
//    component itself; the "default" state is the row grid.
//
// Design notes:
//   - Header at 10.5px uppercase tracking-[0.14em] to match every
//     hand-rolled table already in the app; retrofitting them to use
//     this component is a wash visually.
//   - The swatch chip (§6.1 signature element) sits in a 4px column on
//     the left edge — pass `swatch={(row) => row.hex}` to enable it.
//   - Rows are clickable when `rowHref` is provided AND fully keyboard-
//     reachable: Arrow Up/Down move focus, Enter navigates.
//   - Server pagination is composed by placing <Pager .../> below the
//     table; this component does not manage page state.

import type { Route } from "next";
import { useRouter } from "next/navigation";
import type React from "react";

type Align = "left" | "right" | "center";

export interface Column<T> {
  key:              string;
  header:           React.ReactNode;
  align?:           Align;
  width?:           string;
  render:           (row: T) => React.ReactNode;
  headerClassName?: string;
  cellClassName?:   string;
}

export interface DataTableProps<T> {
  columns:       readonly Column<T>[];
  rows:          readonly T[];
  rowKey:        (row: T) => string;
  rowHref?:      (row: T) => string;   // caller supplies a Route-castable string
  swatch?:       (row: T) => string | undefined;
  ariaLabel?:    string;
  loading?:      boolean;
  skeletonRows?: number;
  emptyState?:   React.ReactNode;
  errorState?:   React.ReactNode;
}

export function DataTable<T>(props: DataTableProps<T>) {
  const skeletonRows = props.skeletonRows ?? 8;

  if (props.errorState != null) {
    return <div className="rounded-[14px] bg-surface border border-rule">{props.errorState}</div>;
  }
  if (props.loading === true) {
    return <SkeletonTable columns={props.columns} rows={skeletonRows} hasSwatch={props.swatch != null} />;
  }
  if (props.rows.length === 0) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule">
        {props.emptyState ?? <DefaultEmptyState />}
      </div>
    );
  }

  return <RowsTable {...props} />;
}

// ── The rendered table (default state) ─────────────────────────────

function RowsTable<T>(props: DataTableProps<T>) {
  const router = useRouter();
  const hasSwatch = props.swatch != null;

  function onKeyDown(e: React.KeyboardEvent<HTMLTableSectionElement>) {
    const target = e.target as HTMLElement;
    const tr = target.closest("tr");
    if (tr == null) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = e.key === "ArrowDown"
        ? (tr.nextElementSibling as HTMLElement | null)
        : (tr.previousElementSibling as HTMLElement | null);
      next?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      (tr.parentElement?.firstElementChild as HTMLElement | null)?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      (tr.parentElement?.lastElementChild as HTMLElement | null)?.focus();
    } else if (e.key === "Enter") {
      const href = tr.dataset["href"];
      if (href) {
        e.preventDefault();
        router.push(href as Route);
      }
    }
  }

  return (
    <div className="rounded-[14px] bg-surface border border-rule overflow-x-auto">
      <table
        className="w-full text-[12.5px] table-fixed"
        role="grid"
        aria-label={props.ariaLabel}
      >
        {hasSwatch && (
          <colgroup>
            <col style={{ width: "6px" }} />
            {props.columns.map((c) => <col key={c.key} style={c.width ? { width: c.width } : undefined} />)}
          </colgroup>
        )}
        {!hasSwatch && (
          <colgroup>
            {props.columns.map((c) => <col key={c.key} style={c.width ? { width: c.width } : undefined} />)}
          </colgroup>
        )}
        <thead>
          <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
            {hasSwatch && <th aria-hidden />}
            {props.columns.map((c) => (
              <th
                key={c.key}
                className={`text-${c.align ?? "left"} py-2.5 px-4 font-normal ${c.headerClassName ?? ""}`}
                scope="col"
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody onKeyDown={onKeyDown}>
          {props.rows.map((row) => {
            const key = props.rowKey(row);
            const href = props.rowHref?.(row);
            const swatchHex = props.swatch?.(row);
            return (
              <tr
                key={key}
                data-href={href}
                tabIndex={href ? 0 : -1}
                className={`border-b border-rule/70 last:border-0 outline-none focus-visible:bg-surface-hover ${
                  href ? "cursor-pointer hover:bg-surface-hover" : ""
                } transition-colors`}
                onClick={href ? () => router.push(href as Route) : undefined}
              >
                {hasSwatch && (
                  <td className="p-0" aria-hidden>
                    {swatchHex ? (
                      <span
                        className="block h-full w-[4px] rounded-r-[2px]"
                        style={{ backgroundColor: swatchHex }}
                      />
                    ) : null}
                  </td>
                )}
                {props.columns.map((c) => (
                  <td
                    key={c.key}
                    className={`py-2 px-4 text-${c.align ?? "left"} ${c.cellClassName ?? ""}`}
                    onClick={
                      // Prevent nested-link clicks from double-navigating
                      c.cellClassName?.includes("stop-propagation")
                        ? (e) => e.stopPropagation()
                        : undefined
                    }
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────

function SkeletonTable<T>({
  columns, rows, hasSwatch,
}: { columns: readonly Column<T>[]; rows: number; hasSwatch: boolean }) {
  return (
    <div className="rounded-[14px] bg-surface border border-rule overflow-x-auto">
      <table className="min-w-[540px] w-full text-[12.5px] table-fixed">
        <thead>
          <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
            {hasSwatch && <th aria-hidden />}
            {columns.map((c) => (
              <th key={c.key} className={`text-${c.align ?? "left"} py-2.5 px-4 font-normal`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody aria-busy="true" aria-live="polite">
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="border-b border-rule/70 last:border-0">
              {hasSwatch && <td className="p-0" aria-hidden />}
              {columns.map((c) => (
                <td key={c.key} className="py-2 px-4">
                  <span className="block h-[10px] w-[70%] rounded-[3px] bg-white/10 animate-pulse" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Default empty state (each caller can pass their own) ───────────

function DefaultEmptyState() {
  return (
    <div className="py-16 text-center">
      <div className="text-[14px] text-text mb-2">Nothing here yet.</div>
      <p className="text-[12px] text-text-dim">
        Records will appear here once they exist.
      </p>
    </div>
  );
}

// ── Named export helper — small, callers compose freely ───────────

export function EmptyState({
  title, body, action,
}: {
  title:  React.ReactNode;
  body?:  React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="py-16 text-center px-6">
      <div className="text-[14px] text-text mb-2">{title}</div>
      {body != null && <p className="text-[12px] text-text-dim">{body}</p>}
      {action != null && <div className="mt-4">{action}</div>}
    </div>
  );
}
