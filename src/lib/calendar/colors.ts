// Appointment-type colour → classes (tokens in globals.css, from the calendar mockups).
// "online" = teal, dashed border (DESIGN §6).
export const CAL_COLOR: Record<string, { box: string; dot: string }> = {
  teal: { box: "border-l-4 border-cal-teal bg-cal-teal-bg text-cal-teal-ink", dot: "bg-cal-teal" },
  tealLight: { box: "border-l-4 border-cal-light bg-cal-light-bg text-cal-light-ink", dot: "bg-cal-light" },
  consult: { box: "border-l-4 border-cal-consult bg-cal-consult-bg text-cal-consult-ink", dot: "bg-cal-consult" },
  recheck: { box: "border-l-4 border-cal-recheck bg-cal-recheck-bg text-cal-recheck-ink", dot: "bg-cal-recheck" },
  amber: { box: "border-l-4 border-cal-amber bg-cal-amber-bg text-cal-amber-ink", dot: "bg-cal-amber" },
  purple: { box: "border-l-4 border-cal-purple bg-cal-purple-bg text-cal-purple-ink", dot: "bg-cal-purple" },
  blue: { box: "border-l-4 border-cal-blue bg-cal-blue text-white", dot: "bg-cal-blue" },
  rose: { box: "border-l-4 border-cal-rose bg-cal-rose-bg text-cal-rose-ink", dot: "bg-cal-rose" },
  grey: { box: "border-l-4 border-cal-grey bg-cal-grey-bg text-cal-grey-ink", dot: "bg-cal-grey" },
  online: { box: "border border-dashed border-cal-teal bg-surface text-cal-teal-ink", dot: "border border-dashed border-cal-teal bg-surface" },
};
export const calColor = (key: string) => CAL_COLOR[key] ?? CAL_COLOR.teal;
