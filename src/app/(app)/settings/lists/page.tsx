import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/back-link";
import { card } from "@/components/ui";
import { activeCompany } from "@/lib/company";
import { EDITABLE_KINDS, isEditableKind, listItems } from "@/lib/settings/lists";
import { requireManager } from "../../admin/guard";
import { addListItemAction, moveListItemAction, renameListItemAction, setListItemActiveAction } from "../actions";
import { ListEditor } from "../list-editor";

// Ρυθμίσεις → Λίστες: the editable lists of the company chosen in the Ιατρείο | Spa switch.
export default async function ListsPage({ searchParams }: PageProps<"/settings/lists">) {
  const { actor } = await requireManager();
  const t = await getTranslations("settingsLists");
  const tn = await getTranslations("nav");
  const tc = await getTranslations("companies");
  const company = await activeCompany(actor);
  const sp = await searchParams;
  const kind = isEditableKind(sp.kind) ? sp.kind : EDITABLE_KINDS[0];
  const items = company ? await listItems(company.id, kind) : [];
  return (
    <main className="mx-auto flex w-full max-w-[900px] flex-col gap-4 px-4 py-6 md:px-8">
      <div>
        <BackLink href="/settings" label={tn("settings")} />
        <h1 className="text-[28px] font-semibold">{t("title")}</h1>
        {company && <p className="text-sm text-muted">{t("forCompany", { company: tc(company.code as "surgery") })}</p>}
      </div>
      <nav aria-label={t("title")} className="flex flex-wrap gap-2">
        {EDITABLE_KINDS.map((k) => (
          <Link
            key={k}
            href={`/settings/lists?kind=${k}`}
            aria-current={k === kind ? "page" : undefined}
            className={`min-h-10 rounded-full px-3.5 py-2 text-sm ${k === kind ? "bg-primary font-semibold text-white" : "border border-line-strong bg-surface text-ink-2 hover:border-primary"}`}
          >
            {t(`kinds.${k}`)}
          </Link>
        ))}
      </nav>
      <section className={`${card} p-5`}>
        <h2 className="mb-1 text-[17px] font-semibold">{t(`kinds.${kind}`)}</h2>
        <p className="mb-3 text-sm text-ink-3">{t(`help.${kind}`)}</p>
        {company && (
          <ListEditor
            items={items.map(({ id, label, isActive }) => ({ id, label, isActive }))}
            add={addListItemAction.bind(null, company.id, kind)}
            rename={renameListItemAction}
            move={moveListItemAction}
            setActive={setListItemActiveAction}
          />
        )}
      </section>
    </main>
  );
}
