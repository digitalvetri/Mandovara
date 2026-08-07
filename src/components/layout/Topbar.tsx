import type { ReactNode } from "react";
import { Search, Plus } from "lucide-react";
import { ScheduleMenu } from "./ScheduleMenu";
import { ThemeToggle } from "./ThemeToggle";

interface TopbarProps {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  /** Show the calendar/schedule menu next to Search. Only the dashboard sets this. */
  showSchedule?: boolean;
}

// Responsive: on mobile the title/eyebrow stack above the actions row;
// search shrinks and the calendar button hides. On ≥ md, everything is
// on one row. The calendar renders only when explicitly enabled — it is
// primarily a dashboard affordance.

export function Topbar({ title, eyebrow, actions, showSchedule }: TopbarProps) {
  return (
    <header className="pt-5 pb-4 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 lg:gap-8">
      <div className="min-w-0">
        <h1 className="font-display text-[22px] sm:text-[26px] lg:text-[30px] xl:text-[32px] leading-tight lg:leading-[1.05] font-semibold text-text break-words">
          {title}
        </h1>
        {eyebrow && (
          <div className="mt-1 text-[12px] text-text-dim">{eyebrow}</div>
        )}
      </div>
      <div className="flex items-center gap-2 md:gap-3 flex-wrap">
        <SearchBox />
        <ThemeToggle />
        {showSchedule && <ScheduleMenu />}
        {actions}
      </div>
    </header>
  );
}

function SearchBox() {
  return (
    <label className="flex items-center gap-2 h-[38px] w-full sm:w-[200px] xl:w-[280px] px-3 bg-surface border border-rule rounded-[8px]">
      <Search size={14} strokeWidth={1.75} className="text-text-faint" />
      <input
        type="text"
        placeholder="Search…"
        className="flex-1 min-w-0 bg-transparent text-[12.5px] outline-none placeholder:text-text-faint"
      />
    </label>
  );
}

export function PrimaryButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 h-[38px] px-4 rounded-[8px]
                 bg-accent text-white text-[12.5px] font-medium
                 hover:bg-accent-hover transition-colors whitespace-nowrap"
    >
      <Plus size={14} strokeWidth={2.25} />
      {children}
    </button>
  );
}
