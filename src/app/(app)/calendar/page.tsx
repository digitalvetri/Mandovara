import { CalendarView } from "./_components/CalendarView";

export const metadata = { title: "Calendar · Mandovara" };

export default function CalendarPage() {
  return (
    <div className="p-6 max-w-[1100px] mx-auto">
      <div className="mb-5">
        <h1 className="text-[22px] font-display font-semibold tracking-tight text-text">Calendar</h1>
        <p className="mt-0.5 text-[12.5px] text-text-dim">Follow-ups and scheduled site visits across all leads and projects.</p>
      </div>
      <CalendarView />
    </div>
  );
}
