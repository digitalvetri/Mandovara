import type { ReactNode } from "react";

// PageHeader — the signature moment on every screen.
// Fraunces title, optional breadcrumb, optional actions slot, then the
// 1px gold hairline at 55% opacity underneath, full content width (§5.4).

interface Crumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  breadcrumb?: Crumb[];
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, breadcrumb, actions }: PageHeaderProps) {
  return (
    <header className="pt-8 pb-4">
      {breadcrumb && breadcrumb.length > 0 ? (
        <nav aria-label="Breadcrumb" className="mb-3">
          <ol className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-paper-dim">
            {breadcrumb.map((c, i) => (
              <li key={i} className="flex items-center gap-2">
                {c.href ? (
                  <a href={c.href} className="hover:text-paper transition-colors">
                    {c.label}
                  </a>
                ) : (
                  <span>{c.label}</span>
                )}
                {i < breadcrumb.length - 1 ? (
                  <span aria-hidden className="text-paper-faint">
                    /
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <div className="flex items-baseline justify-between gap-8">
        <div>
          {eyebrow ? (
            <div className="text-[11px] uppercase tracking-[0.14em] text-paper-dim">
              {eyebrow}
            </div>
          ) : null}
          <h1 className="mt-1 text-[32px] leading-[1.1] font-semibold text-paper font-display">
            {title}
          </h1>
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>

      {/* The gold hairline — appears once per screen and never anywhere else. */}
      <div className="hairline mt-4" />
    </header>
  );
}
