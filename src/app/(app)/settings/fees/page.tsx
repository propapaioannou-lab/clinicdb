import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/back-link";
import { card } from "@/components/ui";
import { requireSession } from "@/lib/auth/current";
import { activeCompany } from "@/lib/company";
import { canHandleMoney } from "@/lib/permissions";
import { listItems } from "@/lib/settings/lists";
import { loadActor } from "@/lib/users/manage";
import { setVisitFeeAction } from "../actions";
import { FeeEditor } from "./fee-editor";

// Χρεώσεις επισκέψεων: which visit types are charged and how much. Money is handled by the
// Secretary and PA/nurse only; the surgeon never sees it (decided 11 Oct 2026).
export default async function FeesPage() {
  const session = await requireSession();
  const actor = await loadActor(session.user.id);
  if (!canHandleMoney(actor)) notFound();
  const t = await getTranslations("settingsFees");
  const tn = await getTranslations("nav");
  const tc = await getTranslations("companies");
  const company = await activeCompany(actor);
  const items = company ? (await listItems(company.id, "VISIT_TYPE")).filter((i) => i.isActive) : [];
  return (
    <main className="mx-auto flex w-full max-w-[900px] flex-col gap-4 px-4 py-6 md:px-8">
      <div>
        <BackLink href="/settings" label={tn("settings")} />
        <h1 className="text-[28px] font-semibold">{t("title")}</h1>
        {company && <p className="text-sm text-muted">{t("intro", { company: tc(company.code as "surgery") })}</p>}
      </div>
      <section className={`${card} p-5`}>
        <FeeEditor
          items={items.map((i) => ({ id: i.id, label: i.label, chargeable: i.chargeable, fee: i.defaultFeeCents === null ? "" : String(i.defaultFeeCents / 100).replace(".", ",") }))}
          save={setVisitFeeAction}
        />
      </section>
    </main>
  );
}
