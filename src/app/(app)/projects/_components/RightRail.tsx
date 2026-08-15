// Right-rail cards for the project detail page.
// Sticky on desktop, stacked on mobile. Client mobile is tappable (tel:/wa).
// Money block is loader-gated — parent passes null when the user lacks
// permission and this component doesn't render it at all (spec §3, §6).

import Link from "next/link";
import { Phone, MessageCircle, MapPin, Crown, User as UserIcon } from "lucide-react";
import { formatINR } from "@/kernel/money/format";
import type { ProjectDetail, ProjectMoney, ProjectTeamRow } from "@/modules/projects/queries";

interface Props {
  project: ProjectDetail;
  money: ProjectMoney | null;
  team: ProjectTeamRow[];
  clientArchitectName?: string | null;
}

export function RightRail({ project, money, team, clientArchitectName }: Props) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-4 lg:h-fit">
      <ClientCard
        clientId={project.clientId}
        name={project.clientName}
        mobile={project.clientMobile}
        architect={clientArchitectName ?? null}
      />
      <SiteCard
        address={project.siteAddress}
        contactName={project.siteContactName}
        contactMobile={project.siteContactMobile}
      />
      {money && <MoneyCard money={money} />}
      <TeamCard team={team} />
    </aside>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[14px] border border-rule bg-surface p-5">
      <div className="mb-3 text-[10.5px] uppercase tracking-[0.16em] text-text-dim">{title}</div>
      {children}
    </section>
  );
}

function ClientCard({ clientId, name, mobile, architect }: {
  clientId: string; name: string; mobile: string; architect: string | null;
}) {
  return (
    <Card title="Client">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <Link
          href={`/clients/${clientId}` as never}
          className="font-display text-[17px] font-semibold leading-tight text-text hover:underline decoration-gold decoration-2 underline-offset-4"
        >
          {name}
        </Link>
        <span className="text-[10px] uppercase tracking-[0.14em] text-text-dim">Homeowner</span>
      </div>

      {mobile && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[12.5px] tabular-nums text-text">{mobile}</span>
          <div className="flex items-center gap-1">
            <a
              href={`tel:${digits(mobile)}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] border border-rule text-text-dim hover:text-text"
              aria-label="Call client"
            >
              <Phone size={12} />
            </a>
            <a
              href={`https://wa.me/${digits(mobile)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] border border-rule text-text-dim hover:text-text"
              aria-label="WhatsApp client"
            >
              <MessageCircle size={12} />
            </a>
          </div>
        </div>
      )}

      <div className="mt-3 border-t border-rule pt-3 text-[11.5px] text-text-dim">
        Architect: <span className="text-text">{architect ?? "—"}</span>
      </div>
    </Card>
  );
}

function SiteCard({ address, contactName, contactMobile }: {
  address: Record<string, unknown> | null; contactName: string | null; contactMobile: string | null;
}) {
  const line = addressLine(address);
  return (
    <Card title="Site">
      {line ? (
        <p className="mb-2 text-[12.5px] leading-relaxed text-text">{line}</p>
      ) : (
        <p className="mb-2 text-[11.5px] text-text-dim italic">Site address not captured yet.</p>
      )}
      {line && (
        <a
          href={`https://maps.google.com/?q=${encodeURIComponent(line)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-text-dim hover:text-text"
        >
          <MapPin size={11} />
          Open in maps
        </a>
      )}
      {(contactName || contactMobile) && (
        <div className="mt-3 border-t border-rule pt-3 text-[11.5px]">
          <div className="text-text-dim">Site contact</div>
          <div className="mt-0.5 text-text">
            {contactName ?? "—"}
            {contactMobile && (
              <>
                <span className="mx-2 text-text-subtle">·</span>
                <span className="tabular-nums">{contactMobile}</span>
              </>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function MoneyCard({ money }: { money: ProjectMoney }) {
  return (
    <Card title="Money">
      <dl className="space-y-2 text-[12.5px]">
        <MoneyRow k="Order" v={formatINR(money.orderValue)} big />
        <MoneyRow k="Advance" v={
          <>
            {formatINR(money.advanceReceived)}
            {money.advanceRequired > 0n && (
              <span className="ml-1 text-text-dim">/ {formatINR(money.advanceRequired)}</span>
            )}
          </>
        } />
        <MoneyRow k="Invoiced" v={formatINR(money.invoiceTotal)} />
        <MoneyRow k="Received" v={formatINR(money.receiptTotal)} />
      </dl>
      <div className="mt-3 border-t border-rule pt-3 flex items-baseline justify-between">
        <span className="text-[11.5px] text-text-dim">Outstanding</span>
        <span className={[
          "font-display tabular-nums text-[20px] font-semibold",
          money.outstanding > 0n ? "text-fault" : "text-solid",
        ].join(" ")}>
          {formatINR(money.outstanding)}
        </span>
      </div>
    </Card>
  );
}

function MoneyRow({ k, v, big }: { k: string; v: React.ReactNode; big?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[11.5px] text-text-dim">{k}</dt>
      <dd className={[
        "tabular-nums text-text text-right",
        big ? "font-display text-[16px] font-medium" : "",
      ].join(" ")}>{v}</dd>
    </div>
  );
}

function TeamCard({ team }: { team: ProjectTeamRow[] }) {
  if (team.length === 0) {
    return (
      <Card title="Team">
        <p className="text-[11.5px] text-text-dim italic">No members assigned yet.</p>
      </Card>
    );
  }
  return (
    <Card title="Team">
      <ul className="space-y-2">
        {team.map((m) => (
          <li key={m.userId} className="flex items-center gap-2.5 text-[12.5px]">
            {m.isOwner
              ? <Crown  size={13} className="text-gold shrink-0" />
              : <UserIcon size={13} className="text-text-dim shrink-0" />}
            <span className="text-text">{m.name}</span>
            <span className="ml-auto text-[10.5px] uppercase tracking-[0.1em] text-text-dim">
              {shortRole(m.role)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function shortRole(r: string): string {
  return r.replace("_", " ").toLowerCase();
}

function digits(s: string): string {
  return s.replace(/[^\d+]/g, "");
}

function addressLine(a: Record<string, unknown> | null): string | null {
  if (!a) return null;
  const parts = ["line1", "line", "street", "area", "city", "state", "pincode", "pin"]
    .map((k) => a[k])
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  return parts.length > 0 ? parts.join(", ") : null;
}
