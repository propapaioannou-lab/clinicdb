import type { PatientFlag } from "@/generated/prisma/client";
import { ageOn } from "@/lib/patients/normalize";
import { athensParts } from "@/lib/time";

// Small coloured marker for the patient flag (SPEC §4); nothing when there is no flag.
export function FlagDot({ flag, label }: { flag: PatientFlag; label: string }) {
  if (flag === "NONE") return null;
  const color = flag === "RED" ? "bg-red-600" : "bg-amber-400";
  return <span title={label} aria-label={label} className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />;
}

export function ageToday(birthDate: Date | null) {
  return birthDate ? ageOn(birthDate, athensParts(new Date())) : null;
}
