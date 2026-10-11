import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/back-link";
import { card } from "@/components/ui";
import { activeCompany } from "@/lib/company";
import { listProcedures } from "@/lib/settings/procedures";
import { PROCEDURE_AREAS } from "@/lib/visits/catalog";
import { requireManager } from "../../admin/guard";
import { addProcedureAction, moveProcedureAction, updateProcedureAction } from "../actions";
import { ProceduresEditor } from "./procedures-editor";

// Ρυθμίσεις → Επεμβάσεις: the procedure catalogue of the company in the Ιατρείο | Spa switch.
export default async function ProceduresSettingsPage({ searchParams }: PageProps<"/settings/procedures">) {
  const { actor } = await requireManager();
  const t = await getTranslations("settingsProcedures");
  const tn = await getTranslations("nav");
  const tc = await getTranslations("companies");
  const company = await activeCompany(actor);
  const sp = await searchParams;
  const area = PROCEDURE_AREAS.find((a) => a.key === sp.area) ?? PROCEDURE_AREAS[0];
  const rows = company ? (await listProcedures(company.id)).filter((r) => r.area === area.key) : [];
  return (
    <main className="mx-auto flex w-full max-w-[1000px] flex-col gap-4 px-4 py-6 md:px-8">
      <div>
        <BackLink href="/settings" label={tn("settings")} />
        <h1 className="text-[28px] font-semibold">{t("title")}</h1>
        {company && <p className="text-sm text-muted">{t("intro", { company: tc(company.code as "surgery") })}</p>}
      </div>
      <nav aria-label={t("title")} className="flex flex-wrap gap-2">
        {PROCEDURE_AREAS.map((a) => (
          <Link
            key={a.key}
            href={`/settings/procedures?area=${a.key}`}
            aria-current={a.key === area.key ? "page" : undefined}
            className={`min-h-10 rounded-full px-3.5 py-2 text-sm ${a.key === area.key ? "bg-primary font-semibold text-white" : "border border-line-strong bg-surface text-ink-2 hover:border-primary"}`}
          >
            {a.el}
          </Link>
        ))}
      </nav>
      <section className={`${card} p-5`}>
        {company && (
          <ProceduresEditor
            rows={rows.map((r) => ({ id: r.id, labelEl: r.labelEl, labelEn: r.labelEn, nonSurgical: r.nonSurgical, isActive: r.isActive, subs: r.subs }))}
            add={addProcedureAction.bind(null, company.id, area.key)}
            update={updateProcedureAction}
            move={moveProcedureAction}
          />
        )}
      </section>
    </main>
  );
}
