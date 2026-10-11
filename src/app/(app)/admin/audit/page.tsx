import { BackLink } from "@/components/back-link";
import { Dropdown } from "@/components/dropdown";
import { backLabel } from "@/components/back-label";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { audit } from "@/lib/audit";
import { ACTION_GROUPS, auditPeople, queryAudit, type ActionGroup } from "@/lib/audit-query";
import { requestContext } from "@/lib/auth/current";
import { endOfAthensDay, startOfAthensDay } from "@/lib/time";
import { describeDevice } from "@/lib/user-agent";
import { listCompanies } from "@/lib/users/queries";
import { requireManager } from "../guard";

type Search = { user?: string; group?: string; from?: string; to?: string; before?: string };

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  const { actor } = await requireManager();
  const sp = (await searchParams) as Search;
  const group = sp.group && sp.group in ACTION_GROUPS ? (sp.group as ActionGroup) : undefined;
  const before = sp.before && /^\d+$/.test(sp.before) ? BigInt(sp.before) : undefined;
  const filters = {
    userId: sp.user || undefined,
    group,
    from: sp.from ? (startOfAthensDay(sp.from) ?? undefined) : undefined,
    to: sp.to ? (endOfAthensDay(sp.to) ?? undefined) : undefined,
    before,
  };

  // Looking at the log is itself logged.
  await audit(
    { action: "audit.viewed", actor, details: { filters: { user: sp.user ?? null, group: group ?? null, from: sp.from ?? null, to: sp.to ?? null } } },
    await requestContext(),
  );

  const [{ entries, nextBefore }, people, companies] = await Promise.all([queryAudit(filters), auditPeople(), listCompanies()]);
  const t = await getTranslations("audit");
  const tl = await getTranslations("levels");
  const tr = await getTranslations("roles");
  const format = await getFormatter();
  const when = (d: Date) =>
    format.dateTime(d, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const companyName = new Map(companies.map((c) => [c.id, c.name]));
  const peopleById = new Map(people.map((p) => [p.id, p.label]));

  // Turn stored details into short readable text.
  const value = (key: string, v: unknown): string => {
    if (v === null || v === undefined) return "—";
    if (Array.isArray(v)) return v.map((x) => value(key, x)).join(", ");
    if (typeof v === "string") {
      if (key === "level" && ["OWNER", "ADMIN", "USER", "GUEST"].includes(v)) return tl(v as "USER");
      if (key === "role" && tr.has(v)) return tr(v as "OTHER");
      if (key === "companyIds") return companyName.get(v) ?? v;
      if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return when(new Date(v));
      if (t.has(`reasons.${v}`)) return t(`reasons.${v}` as "reasons.logout");
    }
    if (typeof v === "boolean") return v ? "✓" : "✗";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  };
  const label = (k: string) => (t.has(`fields.${k}`) ? t(`fields.${k}` as "fields.level") : k);
  const describe = (d: Record<string, unknown> | null): string[] => {
    if (!d) return [];
    return Object.entries(d)
      .filter(([k]) => k !== "userId" && k !== "error")
      .map(([k, v]) => {
        if (k === "filters" && v && typeof v === "object") {
          const f = v as { user?: string | null; group?: string | null; from?: string | null; to?: string | null };
          const parts = [
            f.user && `${t("person")}: ${peopleById.get(f.user) ?? f.user}`,
            f.group && t.has(`groups.${f.group}`) && `${t("group")}: ${t(`groups.${f.group}` as "groups.logins")}`,
            f.from && `${t("from")} ${f.from}`,
            f.to && `${t("to")} ${f.to}`,
          ].filter(Boolean);
          return parts.length ? `${label(k)}: ${parts.join(", ")}` : "";
        }
        if (v && typeof v === "object" && !Array.isArray(v) && "from" in v && "to" in v) {
          const c = v as { from: unknown; to: unknown };
          return `${label(k)}: ${value(k, c.from)} → ${value(k, c.to)}`;
        }
        return `${label(k)}: ${value(k, v)}`;
      })
      .filter(Boolean);
  };
  // Translation keys cannot contain dots: "auth.login.success" -> "auth_login_success".
  const actionLabel = (a: string) => {
    const key = `actions.${a.replaceAll(".", "_")}`;
    return t.has(key) ? t(key as "actions.audit_viewed") : a;
  };
  const person = (p: { name: string; deleted: boolean } | null, fallback: string | null) =>
    p ? `${p.name}${p.deleted ? ` ${t("deletedMark")}` : ""}` : (fallback ?? t("system"));
  const keep = (extra: Record<string, string>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ user: sp.user, group: sp.group, from: sp.from, to: sp.to, ...extra })) if (v) q.set(k, v);
    return `/admin/audit?${q}`;
  };

  return (
    <main className="mx-auto w-full max-w-7xl p-4">
      <BackLink href="/settings" label={await backLabel("settings")} />
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mb-4 text-sm text-neutral-500">{t("intro")}</p>

      <form method="get" className="mb-4 grid gap-3 sm:grid-cols-5">
        <label className="text-sm font-medium sm:col-span-2">
          {t("person")}
          <Dropdown
            name="user"
            label={t("person")}
            defaultValue={sp.user || undefined}
            placeholder={t("everyone")}
            options={people.map((p) => ({ value: p.id, label: `${p.label}${p.deleted ? ` ${t("deletedMark")}` : ""}` }))}
            className="mt-1"
          />
        </label>
        <label className="text-sm font-medium">
          {t("group")}
          <Dropdown
            name="group"
            label={t("group")}
            defaultValue={group || undefined}
            placeholder={t("allGroups")}
            options={Object.keys(ACTION_GROUPS).map((g) => ({ value: g, label: t(`groups.${g}` as "groups.logins") }))}
            className="mt-1"
          />
        </label>
        <label className="text-sm font-medium">
          {t("from")}
          <input type="date" name="from" defaultValue={sp.from ?? ""} className={inputClass} />
        </label>
        <label className="text-sm font-medium">
          {t("to")}
          <input type="date" name="to" defaultValue={sp.to ?? ""} className={inputClass} />
        </label>
        <div className="flex gap-2 sm:col-span-5">
          <button type="submit" className={primaryButton}>{t("filter")}</button>
          <Link href="/admin/audit" className={secondaryButton}>{t("clear")}</Link>
        </div>
      </form>

      {entries.length === 0 ? (
        <p className="text-sm text-neutral-500">{t("none")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="py-2 pr-4">{t("when")}</th>
                <th className="py-2 pr-4">{t("who")}</th>
                <th className="py-2 pr-4">{t("what")}</th>
                <th className="py-2 pr-4">{t("whom")}</th>
                <th className="py-2 pr-4">{t("details")}</th>
                <th className="py-2 pr-4">{t("where")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-neutral-100 align-top dark:border-neutral-900">
                  <td className="whitespace-nowrap py-2 pr-4 font-mono text-xs">{when(e.at)}</td>
                  <td className="py-2 pr-4">
                    {e.actorId ? (
                      <Link href={keep({ user: e.actorId, before: "" })} className="underline-offset-2 hover:underline">{person(e.actor, e.actorEmail)}</Link>
                    ) : (
                      <span className="text-neutral-500">{e.actorEmail ?? t("system")}</span>
                    )}
                  </td>
                  <td className={`py-2 pr-4 ${e.action.includes("failure") || e.action.includes("locked") ? "text-red-700 dark:text-red-300" : ""}`}>
                    {actionLabel(e.action)}
                  </td>
                  <td className="py-2 pr-4">
                    {e.patient && (
                      <Link href={`/patients/${e.patient.id}`} className="underline-offset-2 hover:underline">
                        {t("patient", { number: e.patient.number })} · {e.patient.surname} {e.patient.firstName}
                      </Link>
                    )}
                    {e.targetId && (
                      <Link href={keep({ user: e.targetId, before: "" })} className="underline-offset-2 hover:underline">{person(e.target, e.targetId)}</Link>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-xs text-neutral-600 dark:text-neutral-400">
                    {describe(e.details).map((line, i) => <div key={i}>{line}</div>)}
                  </td>
                  <td className="py-2 pr-4 text-xs text-neutral-500">
                    <div className="font-mono">{e.ip ?? "—"}</div>
                    {e.userAgent && <div>{describeDevice(e.userAgent)}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex justify-between text-sm">
        {before ? <Link href={keep({ before: "" })} className="underline">{t("newest")}</Link> : <span />}
        {nextBefore && <Link href={keep({ before: nextBefore })} className="underline">{t("older")}</Link>}
      </div>
    </main>
  );
}
