import type { PatientFlag } from "@/generated/prisma/client";
import { ageOn } from "@/lib/patients/normalize";
import { athensParts } from "@/lib/time";

// Small coloured marker for the patient flag (SPEC §4); nothing when there is no flag.
export function FlagDot({ flag, label }: { flag: PatientFlag; label: string }) {
  if (flag === "NONE") return null;
  const color = flag === "RED" ? "bg-red-600" : "bg-amber-400";
  return <span title={label} aria-label={label} className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />;
}

// "Υψηλός κίνδυνος" (high-risk profile from the medical history), wherever the patient appears.
export function RiskBadge({ label, reasons, compact }: { label: string; reasons?: string[]; compact?: boolean }) {
  return (
    <span
      title={reasons?.join(", ")}
      className={`inline-flex items-center gap-1.5 rounded-full bg-danger px-2.5 py-0.5 font-semibold text-white ${compact ? "text-[11px]" : "text-[12.5px]"}`}
    >
      <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18v.5" /></svg>
      {label}
      {!compact && reasons?.length ? <span className="font-medium">· {reasons.join(", ")}</span> : null}
    </span>
  );
}

export function ageToday(birthDate: Date | null) {
  return birthDate ? ageOn(birthDate, athensParts(new Date())) : null;
}
