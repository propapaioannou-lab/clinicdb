import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { PatientsIcon, PlusIcon } from "@/components/icons";
import { card, primaryButton, secondaryButton } from "@/components/ui";
import { requireSession } from "@/lib/auth/current";
import { canEditPatients } from "@/lib/permissions";

// Placeholder home until the calendar (Phase 6) brings today's appointments (DESIGN.md).
export default async function Home() {
  const { user } = await requireSession();
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
