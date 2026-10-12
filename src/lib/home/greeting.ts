import greetings from "../../../content/greetings.el.json";

// Daily greeting on the physician home (SPEC §4e): "Καλημέρα / Καλό μεσημέρι / Καλησπέρα,
// γιατρέ" by the hour, plus one line that changes every day (same all day): item
// (days since 1 Jan 2026) mod count. Editing the list in Settings comes later.
type Item = { id: number; text: string; kind: string; disabled?: boolean };
const items = (greetings.items as Item[]).filter((i) => !i.disabled);

export function greetingFor(isoDate: string, hour: number) {
  const days = Math.floor((Date.UTC(+isoDate.slice(0, 4), +isoDate.slice(5, 7) - 1, +isoDate.slice(8, 10)) - Date.UTC(2026, 0, 1)) / 864e5);
  const line = items[((days % items.length) + items.length) % items.length];
  const hello = hour < 12 ? "Καλημέρα" : hour < 17 ? "Καλό μεσημέρι" : "Καλησπέρα";
  return { hello: `${hello}, γιατρέ`, line: line.text, humour: line.kind !== "support" };
}
