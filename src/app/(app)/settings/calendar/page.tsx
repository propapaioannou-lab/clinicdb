import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { BackLink } from "@/components/back-link";
import { card } from "@/components/ui";
import { requireSession } from "@/lib/auth/current";
import { calendarConfigOf } from "@/lib/calendar/config";
import { hoursOf } from "@/lib/calendar/hours";
import { activeCompany } from "@/lib/company";
import { canEditPatients } from "@/lib/permissions";
import { calendarSettings } from "@/lib/settings/calendar";
import { canManageSettings } from "@/lib/settings/lists";
import { loadActor } from "@/lib/users/manage";
import { addBlockAction, moveCalendarItemAction, removeBlockAction, saveCalendarConfigAction, saveResourceAction, saveTypeAction } from "../actions";
import { BlocksSettings, HoursRulesSettings, ResourcesSettings, TypesSettings } from "./calendar-settings";

// Ρυθμίσεις → Ημερολόγιο (Phase 6a): types and resources for Owner/Admin; blocked time
// (congress, leave, break) for any staff member. Per company (Ιατρείο | Spa switch).
export default async function CalendarSettingsPage({ searchParams }: PageProps<"/settings/calendar">) {
  const session = await requireSession();
  const actor = await loadActor(session.user.id);
  if (!canEditPatients(actor.level)) notFound();
  const manager = canManageSettings(actor);
  const t = await getTranslations("settingsCalendar");
  const tn = await getTranslations("nav");
  const tc = await getTranslations("companies");
  const format = await getFormatter();
  const company = await activeCompany(actor);
  if (!company) notFound();
  const sp = await searchParams;
  const tabs = [...(manager ? (["hours", "types", "resources"] as const) : []), "blocks"] as const;
  const tab = (tabs as readonly string[]).includes(sp.tab as string) ? (sp.tab as (typeof tabs)[number]) : tabs[0];
  const [data, rules] = await Promise.all([calendarSettings(company.id), calendarConfigOf(company.id)]);
  const when = (d: Date) => format.dateTime(d, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return (
    <main className="mx-auto flex w-full max-w-[1000px] flex-col gap-4 px-4 py-6 md:px-8">
      <div>
        <BackLink href="/settings" label={tn("settings")} />
        <h1 className="text-[28px] font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted">{t("intro", { company: tc(company.code as "surgery") })}</p>
      </div>
      <nav aria-label={t("title")} className="flex flex-wrap gap-2">
        {tabs.map((k) => (
          <Link key={k} href={`/settings/calendar?tab=${k}`} aria-current={k === tab ? "page" : undefined}
            className={`min-h-10 rounded-full px-3.5 py-2 text-sm ${k === tab ? "bg-primary font-semibold text-white" : "border border-line-strong bg-surface text-ink-2 hover:border-primary"}`}>
            {t(`tabs.${k}`)}
          </Link>
        ))}
      </nav>
      <section className={`${card} p-5`}>
        <p className="mb-3 text-sm text-ink-3">{t(`help.${tab}`)}</p>
        {tab === "hours" && (
          <HoursRulesSettings
            initial={rules}
            columns={data.resources.filter((r) => r.isActive && (r.kind === "DOCTOR" || r.kind === "NURSE" || r.kind === "CABIN")).map((r) => ({ id: r.id, label: r.label, hours: hoursOf(r.hours) }))}
            save={saveCalendarConfigAction.bind(null, company.id)}
          />
        )}
        {tab === "types" && (
          <TypesSettings
            rows={data.types.map((x) => ({ id: x.id, labelEl: x.labelEl, labelEn: x.labelEn, color: x.color, defaultMinutes: x.defaultMinutes, layer: x.layer, isActive: x.isActive, forNewPatients: x.forNewPatients }))}
            save={saveTypeAction.bind(null, company.id)}
            move={moveCalendarItemAction.bind(null, "type")}
          />
        )}
        {tab === "resources" && (
          <ResourcesSettings
            rows={data.resources.map((x) => ({ id: x.id, label: x.label, kind: x.kind, userId: x.userId, hours: hoursOf(x.hours), isActive: x.isActive }))}
            users={data.users.map((u) => ({ id: u.id, name: u.name }))}
            save={saveResourceAction.bind(null, company.id)}
            move={moveCalendarItemAction.bind(null, "resource")}
          />
        )}
        {tab === "blocks" && (
          <BlocksSettings
            rows={data.blocks.map((b) => ({ id: b.id, resourceId: b.resourceId, kind: b.kind, label: b.label, from: when(b.startsAt), to: when(b.endsAt) }))}
            resources={data.resources.filter((r) => r.isActive).map((r) => ({ id: r.id, label: r.label }))}
            add={addBlockAction.bind(null, company.id)}
            remove={removeBlockAction}
          />
        )}
      </section>
    </main>
  );
}
