"use client";

import { usePathname } from "next/navigation";

// The top bar with the patient search. On the calendar, tablets and computers have the
// search next to the calendar instead (calendar v3), so the bar gives its room to the
// calendar; phones keep it.
export function TopBar({ children }: { children: React.ReactNode }) {
  const onCalendar = usePathname().startsWith("/calendar");
  return (
    <header className={`sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface-2 px-4 py-3 md:px-8 md:py-[18px] ${onCalendar ? "md:hidden" : ""}`}>
      {children}
    </header>
  );
}
