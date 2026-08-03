import Link from "next/link";
import type { Route } from "next";
import { Topbar } from "@/components/layout/Topbar";
import { formatDate } from "@/kernel/datetime";
import { shortNumber } from "@/lib/short-number";
import { devContext } from "@/lib/dev-context";
import { loadInstallations, listActiveProjectsForSnag } from "@/modules/installations/queries";
import { SnagStatusChanger, PostSnagButton } from "./_components/SnagActions";

export const dynamic = "force-dynamic";

export default async function InstallationsPage() {
  const ctx = await devContext();
  const [data, projects] = await Promise.all([
    loadInstallations(ctx, 30),
    listActiveProjectsForSnag(ctx),
  ]);

  // Group upcoming milestones by day-key.
  const byDay = new Map<string, typeof data.upcoming>();
  for (const m of data.upcoming) {
    const key = m.plannedDate.toISOString().slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(m);
  }

  return (
    <>
      <Topbar
        title="Installations"
        eyebrow={`${data.upcoming.length} scheduled in next ${data.windowDays} days · ${data.snags.length} open snag${data.snags.length === 1 ? "" : "s"} across ${data.activeProjectCount} active project${data.activeProjectCount === 1 ? "" : "s"}`}
        actions={<PostSnagButton projects={projects} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-10">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
            <div className="px-4 py-3 border-b border-rule flex items-baseline justify-between">
              <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
                Upcoming schedule
              </div>
              <div className="text-[11px] text-text-dim tabular">
                {data.upcoming.length} milestone{data.upcoming.length === 1 ? "" : "s"}
              </div>
            </div>
            {data.upcoming.length === 0 ? (
              <div className="py-10 text-center text-[12px] text-text-faint">
                No installations planned in the next {data.windowDays} days.
              </div>
            ) : (
              <div>
                {[...byDay.entries()].map(([dayKey, items]) => (
                  <div key={dayKey} className="border-b border-rule/60 last:border-0">
                    <div className="px-4 py-2 bg-bg/50 flex items-baseline justify-between">
                      <div className="text-[11px] font-medium text-text tabular">
                        {formatDate(new Date(dayKey))}
                      </div>
                      <div className="text-[10.5px] text-text-dim">
                        {items.length} site{items.length === 1 ? "" : "s"}
                      </div>
                    </div>
                    <ul className="divide-y divide-rule/60">
                      {items.map((m) => (
                        <li key={m.id} className="px-4 py-3 grid grid-cols-[1fr_auto] gap-3 items-center">
                          <div>
                            <div className="text-[12.5px] text-text">
                              <Link href={`/projects/${m.projectId}` as Route}
                                    className="hover:text-accent tabular text-[11.5px] text-text-dim mr-2">
                                {shortNumber(m.projectNumber, "P-")}
                              </Link>
                              {m.projectName} <span className="text-text-dim">— {m.name}</span>
                            </div>
                            <div className="text-[11px] text-text-dim mt-0.5">
                              {m.clientName}
                              {m.city && <span> · {m.city}</span>}
                              <span className="tabular ml-2">{m.clientMobile}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="tabular text-[11px] text-text-dim">{m.billingPct}% billable</div>
                            <div className="text-[10.5px] uppercase tracking-[0.06em] text-text-faint mt-0.5">
                              {m.status.toLowerCase()}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[14px] bg-surface border border-rule overflow-hidden h-fit">
          <div className="px-4 py-3 border-b border-rule">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
              Open snags ({data.snags.length})
            </div>
          </div>
          {data.snags.length === 0 ? (
            <div className="py-10 text-center text-[12px] text-text-faint">
              No open snags. Nice.
            </div>
          ) : (
            <ul className="divide-y divide-rule/60">
              {data.snags.map((s) => (
                <li key={s.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <Link href={`/projects/${s.projectId}` as Route}
                          className="text-[11px] tabular text-text-dim hover:text-accent">
                      {shortNumber(s.projectNumber, "P-")}
                    </Link>
                    <SnagStatusChanger id={s.id} current={s.status} />
                  </div>
                  <div className="text-[12.5px] text-text">{s.location}</div>
                  <div className="text-[11.5px] text-text-dim mt-0.5">{s.description}</div>
                  <div className="text-[10.5px] text-text-faint tabular mt-1">
                    logged {formatDate(s.createdAt)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
