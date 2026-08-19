// Select — a styled NATIVE <select>.
//
// Deliberately native rather than a custom listbox: half this app's users are
// on a phone at a site, where the OS picker is faster, works one-thumb, and
// needs no JS. What was wrong before was not the element but that it was left
// entirely unstyled, so every filter row showed a stock grey OS control in the
// middle of an otherwise designed page.

import type { SelectHTMLAttributes } from "react";

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Rendered as the disabled first option when the value is empty. */
  placeholder?: string;
  size2?: "sm" | "md";
}

export function Select({
  placeholder,
  size2 = "md",
  className = "",
  children,
  ...rest
}: Props) {
  // The chevron, border and radius come from the global :where(select) rule
  // in globals.css — this only adds sizing and the placeholder option.
  const h = size2 === "sm" ? "h-[30px] text-[12px] pl-2.5" : "h-[36px] text-[12.5px] pl-3";
  return (
    <div className="relative inline-flex items-center min-w-0">
      <select
        {...rest}
        className={[
          "w-full min-w-0 bg-surface text-text rounded-[8px]",
          "disabled:opacity-45 disabled:cursor-not-allowed",
          h,
          className,
        ].join(" ")}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {children}
      </select>
    </div>
  );
}
