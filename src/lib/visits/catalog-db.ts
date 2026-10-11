import { db } from "@/lib/db";
import { PROCEDURE_AREAS, type Catalog, type Sub } from "./catalog";

// A company's procedure catalogue (Settings → Επεμβάσεις). Until the seed has filled it
// (a brand-new database, tests) the starting catalogue in code is used.
export async function loadCatalog(companyId: string): Promise<Catalog> {
  const rows = await db.catalogProcedure.findMany({ where: { companyId }, orderBy: [{ sortOrder: "asc" }, { labelEl: "asc" }] });
  if (!rows.length) return PROCEDURE_AREAS;
  return PROCEDURE_AREAS.map((area) => ({
    key: area.key,
    el: area.el,
    en: area.en,
    procedures: rows
      .filter((r) => r.area === area.key)
      .map((r) => {
        const subs = cleanSubs(r.subs);
        return {
          key: r.key,
          el: r.labelEl,
          en: r.labelEn,
          ...(r.nonSurgical && { nonSurgical: true }),
          ...(!r.isActive && { hidden: true }),
          ...(subs.length && { subs }),
        };
      }),
  }));
}

export function cleanSubs(raw: unknown): Sub[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && typeof x.key === "string" && typeof x.labelEl === "string")
    .map((x) => ({ key: x.key as string, el: x.labelEl as string, en: typeof x.labelEn === "string" ? x.labelEn : (x.labelEl as string), ...(x.hidden === true && { hidden: true }) }));
}
