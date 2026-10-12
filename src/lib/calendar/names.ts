import { phoneDigits } from "@/lib/patients/normalize";

// Small helpers shared by the server and the booking screens (no database here).

// "Ιωάννα Ράπη" → first name Ιωάννα, surname Ράπη (as people say it); one word = surname.
export function splitName(full: string) {
  const words = full.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length <= 1) return { firstName: "", surname: words[0] ?? "" };
  return { firstName: words.slice(0, -1).join(" "), surname: words[words.length - 1] };
}

// "69•• ••• 214": enough to recognise a number on screen, not to read it out.
export const maskPhone = (n: string | null) => {
  const d = n ? phoneDigits(n) : "";
  return d.length >= 6 ? `${d.slice(0, 2)}•• ••• ${d.slice(-3)}` : null;
};
