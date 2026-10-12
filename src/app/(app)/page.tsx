import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { PatientsIcon, PlusIcon } from "@/components/icons";
import { LiveRefresh } from "@/components/live/live-refresh";
import { card, primaryButton, secondaryButton } from "@/components/ui";
import { requireSession } from "@/lib/auth/current";
import { calendarDay } from "@/lib/calendar/day";
import { surgeonResources } from "@/lib/calendar/views";
import { activeCompany } from "@/lib/company";
import { canEditPatients } from "@/lib/permissions";
import { athensIsoDate, athensParts } from "@/lib/time";
import { loadActor } from "@/lib/users/manage";
import { DeskHome, PaHome, PhysicianHome } from "./_home/homes";

// Home (Phase 6a-4): by role — physician 1a, PA/nurse 1b, everyone else at the front 1e.
// Guests (research) keep the simple page.
export default async function Home() {
  const { user } = await requireSession();
  const actor = await loadActor(user.id);
  const company = canEditPatients(actor.level) ? await activeCompany(actor) : null;
  if (company) {
    const today = athensIsoDate(new Date());
    const data = await calendarDay(actor, company.id, today);
    if (data) {
      const t = await getTranslations();
      const p = athensParts(new Date());
      const common = {
        data,
        nowMin: p.hour * 60 + p.minute,
        dateLabel: new Intl.DateTimeFormat("el-GR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${today}T12:00:00Z`)),
        companyLabel: t.has(`companies.${company.code}`) ? t(`companies.${company.code}` as "companies.surgery") : company.name,
      };
      let body;
      if (actor.role === "SURGEON") {
        body = <PhysicianHome {...common} resourceIds={await surgeonResources(actor.id, company.id)} />;
      } else {
        body = actor.role === "PA_NURSE" ? <PaHome {...common} /> : <DeskHome {...common} />;
      }
      return (
        <>
          <LiveRefresh companyId={company.id} />
          {body}
        </>
      );
    }
  }

  const t = await getTranslations("home");
  const format = await getFormatter();
  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-5 px-4 py-6 md:px-8">
      <div>
        <h1 className="text-[28px] font-semibold">{t("today")}</h1>
        <p className="text-muted">{format.dateTime(new Date(), { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
      </div>
      <section className={`${card} flex flex-col gap-4 p-6`}>
        <p className="text-[15px] text-ink-3">{t("placeholder", { name: user.name })}</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/patients" className={`${secondaryButton}`}><PatientsIcon size={18} />{t("patients")}</Link>
          {canEditPatients(user.level) && (
            <Link href="/patients/new" className={primaryButton}><PlusIcon />{t("newPatient")}</Link>
          )}
        </div>
      </section>
    </main>
  );
}
