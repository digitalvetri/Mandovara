"use client";

import { useTransition, useState } from "react";
import type { RoleRow, ModuleGroup } from "@/modules/admin/roles-queries";
import { togglePermission } from "@/modules/admin/roles-actions";

interface Props {
  roles:   RoleRow[];
  groups:  ModuleGroup[];
  granted: Record<string, Record<string, boolean>>;
}

export function PermMatrixClient({ roles, groups, granted }: Props) {
  return (
    <div className="rounded-[14px] bg-surface border border-rule overflow-x-auto">
      <table className="w-full text-[11.5px] border-collapse">
        <thead>
          <tr className="border-b border-rule">
            <th className="sticky left-0 bg-surface z-10 text-left px-4 py-3 text-[10px] uppercase tracking-[0.14em] text-text-dim font-semibold min-w-[180px]">
              Permission
            </th>
            {roles.map((r) => (
              <th key={r.id} className="px-3 py-3 text-center text-[10.5px] font-semibold text-text whitespace-nowrap min-w-[90px]">
                {r.name}
                {r.isOwnerRole && (
                  <span className="ml-1 text-[9px] text-accent">★</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <>
              <tr key={`${group.module}-header`} className="bg-surface-2/40">
                <td
                  colSpan={roles.length + 1}
                  className="sticky left-0 px-4 py-1.5 text-[10px] uppercase tracking-[0.16em] text-accent font-semibold bg-surface-2/40"
                >
                  {group.label}
                </td>
              </tr>
              {group.actions.map((key) => {
                const actionLabel = key.split(".").slice(1).join(".");
                return (
                  <tr key={key} className="border-t border-rule/40 hover:bg-surface-2/30 transition-colors">
                    <td className="sticky left-0 bg-surface hover:bg-surface-2/30 px-4 py-1.5 text-[11px] text-text-dim font-mono">
                      {actionLabel}
                    </td>
                    {roles.map((role) => (
                      <td key={role.id} className="px-3 py-1.5 text-center">
                        <PermCell
                          roleId={role.id}
                          permKey={key}
                          granted={granted[role.id]?.[key] ?? false}
                          disabled={role.isOwnerRole}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PermCell({
  roleId, permKey, granted: initial, disabled,
}: {
  roleId:  string;
  permKey: string;
  granted: boolean;
  disabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    if (disabled) return;
    setError(null);
    startTransition(async () => {
      const res = await togglePermission({ roleId, key: permKey, grant: !initial });
      if (!res.ok) setError(res.error ?? "Failed");
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled || pending}
      title={error ?? undefined}
      aria-label={`${initial ? "Revoke" : "Grant"} ${permKey} for role`}
      className={`w-5 h-5 rounded-[4px] border transition-colors mx-auto flex items-center justify-center ${
        error
          ? "bg-fault/20 border-fault cursor-pointer"
          : disabled
          ? "bg-accent/20 border-accent/30 cursor-default"
          : initial
          ? "bg-accent border-accent hover:bg-accent/80 cursor-pointer"
          : "bg-transparent border-rule hover:border-accent/60 cursor-pointer"
      } ${pending ? "opacity-50" : ""}`}
    >
      {(initial || disabled) && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            className={disabled ? "text-accent/70" : "text-ink"} />
        </svg>
      )}
    </button>
  );
}
