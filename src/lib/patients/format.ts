// How a patient number is shown (DESIGN.md mockups): P-004218 for the Surgery practice,
// S-000123 for the Spa. Stored as a plain number (SPEC §4).
const PREFIX: Record<string, string> = { surgery: "P", spa: "S" };

export function patientCode(number: number, companyCode: string) {
  return `${PREFIX[companyCode] ?? "P"}-${String(number).padStart(6, "0")}`;
}
