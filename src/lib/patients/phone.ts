// Country codes offered in front of a phone number; Greece first (the default).
export const COUNTRY_CODES = [
  { iso: "GR", code: "+30" }, { iso: "CY", code: "+357" }, { iso: "GB", code: "+44" }, { iso: "DE", code: "+49" },
  { iso: "FR", code: "+33" }, { iso: "IT", code: "+39" }, { iso: "NL", code: "+31" }, { iso: "BE", code: "+32" },
  { iso: "CH", code: "+41" }, { iso: "AT", code: "+43" }, { iso: "SE", code: "+46" }, { iso: "AL", code: "+355" },
  { iso: "BG", code: "+359" }, { iso: "RO", code: "+40" }, { iso: "UA", code: "+380" }, { iso: "RU", code: "+7" },
  { iso: "AE", code: "+971" }, { iso: "AU", code: "+61" }, { iso: "US", code: "+1" },
] as const;

export const DEFAULT_CODE = "+30";

// "+357 99 123456" -> { code: "+357", local: "99 123456" }. Numbers stored without a code
// (older records) are Greek. "0030 69…" counts as +30.
export function splitPhone(number: string): { code: string; local: string } {
  const n = number.trim().replace(/^00/, "+");
  if (!n.startsWith("+")) return { code: DEFAULT_CODE, local: n };
  const known = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length).find((c) => n.replace(/\s/g, "").startsWith(c.code));
  if (!known) return { code: DEFAULT_CODE, local: n };
  let rest = n.slice(1);
  for (const digit of known.code.slice(1)) rest = rest.replace(new RegExp(`^\\s*${digit}`), "");
  return { code: known.code, local: rest.trim() };
}

export function joinPhone(code: string, local: string): string {
  const l = local.trim();
  return l ? `${code} ${l}` : "";
}
