import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/back-link";
import { activeCompany } from "@/lib/company";
import { HISTORY_SECTIONS } from "@/lib/history/history";
import { listQuestions } from "@/lib/settings/history-questions";
import { requireManager } from "../../admin/guard";
import { addQuestionAction, moveQuestionAction, updateQuestionAction } from "../actions";
import { QuestionsEditor } from "./questions-editor";

// Ρυθμίσεις → Ιατρικό ιστορικό: the questionnaire of the company in the Ιατρείο | Spa switch.
export default async function HistorySettingsPage() {
  const { actor } = await requireManager();
  const t = await getTranslations("settingsHistory");
  const tn = await getTranslations("nav");
  const tc = await getTranslations("companies");
  const company = await activeCompany(actor);
  const questions = company ? await listQuestions(company.id) : [];
  return (
    <main className="mx-auto flex w-full max-w-[1000px] flex-col gap-4 px-4 py-6 md:px-8">
      <div>
        <BackLink href="/settings" label={tn("settings")} />
        <h1 className="text-[28px] font-semibold">{t("title")}</h1>
        {company && <p className="text-sm text-muted">{t("intro", { company: tc(company.code as "surgery") })}</p>}
      </div>
      {company && (
        <QuestionsEditor
          questions={questions.map((q) => ({
            id: q.id, key: q.key, section: q.section, labelEl: q.labelEl, labelEn: q.labelEn, detailEl: q.detailEl, detailEn: q.detailEn,
            hintEl: q.hintEl, hintEn: q.hintEn, sensitive: q.sensitive, infection: q.infection, isActive: q.isActive, choices: q.choices,
          }))}
          sections={HISTORY_SECTIONS}
          add={addQuestionAction.bind(null, company.id)}
          update={updateQuestionAction}
          move={moveQuestionAction}
        />
      )}
    </main>
  );
}
