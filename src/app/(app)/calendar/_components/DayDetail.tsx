import { CalendarDays } from "lucide-react";
import { FollowUpItem, type CalendarItem } from "./FollowUpItem";
import { sameDay, startOfDay } from "./calendarUtils";

export function DayDetail({ day, items, loading, onRefresh }: {
  day: Date; items: CalendarItem[]; loading: boolean; onRefresh: () => void;
}) {
  const isToday = sameDay(day, startOfDay(new Date()));
  return (
    <div>
      <div className="flex items-center justify-between px-5 py-3 border-t border-rule/60">
        <div className="text-[12px] font-semibold text-text">
          {isToday && <span className="text-accent mr-1.5">Today ·</span>}
          {day.toLocaleDateString("en-IN",{ weekday:"long", day:"numeric", month:"long" })}
        </div>
        <span className="text-[11px] text-text-faint">
          {loading ? "Loading…" : `${items.length} item${items.length===1?"":"s"}`}
        </span>
      </div>
      {!loading && items.length === 0 && (
        <div className="px-5 pb-5 flex flex-col items-center py-8 text-center gap-2">
          <CalendarDays size={28} strokeWidth={1.25} className="text-text-faint" />
          <p className="text-[12.5px] text-text-dim">Nothing scheduled for this day.</p>
        </div>
      )}
      {items.map(it => <FollowUpItem key={it.id} item={it} onRescheduled={onRefresh} />)}
    </div>
  );
}
