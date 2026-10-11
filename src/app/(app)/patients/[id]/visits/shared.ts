import "server-only";
import { getFormatter, getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import type { HistoryData } from "@/lib/history/data";
import { loadHistory } from "@/lib/history/history";
import type { Actor } from "@/lib/users/manage";

// Visit types of the patient's company, in list order.
export async function visitTypes(companyId: string) {
  return db.listItem.findMany({
    where: { companyId, kind: "VISIT_TYPE", isActive: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    select: { id: true, label: true, chargeable: true },
  });
}

// "Πενικιλίνη, ΜΣΑΦ · κνίδωση" from the medical history, or null.
export async function allergySummary(actor: Actor, patientId: string): Promise<{ text: string | null; history: HistoryData | null }> {
  const h = await loadHistory(actor, patientId);
  const a = h?.data?.allergies;
  if (!a || a.a !== "yes") return { text: null, history: h?.data ?? null };
  const th = await getTranslations("history");
  const text = [(a.items ?? []).map((k) => th(`allergyItems.${k}` as "allergyItems.penicillin")).join(", "), a.d].filter(Boolean).join(" · ") || th("yes");
  return { text, history: h?.data ?? null };
}

export async function shortDate(d: Date) {
  const format = await getFormatter();
  return format.dateTime(d, { day: "2-digit", month: "2-digit", year: "2-digit" });
}
