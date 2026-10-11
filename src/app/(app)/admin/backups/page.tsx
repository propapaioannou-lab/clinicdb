import { getFormatter, getTranslations } from "next-intl/server";
import { Badge, ErrorBox, Notice, Section } from "@/components/ui";
import { backupHealth, listBackupRuns, STALE_AFTER_HOURS } from "@/lib/backups";
import { requireManager } from "../guard";

export default async function BackupsPage() {
  await requireManager();
  const [health, runs] = await Promise.all([backupHealth(), listBackupRuns()]);
  const t = await getTranslations("backups");
  const format = await getFormatter();
  const when = (d: Date) => format.dateTime(d, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const size = (b: bigint | null) => (b === null ? "—" : `${format.number(Number(b) / 1024 / 1024, { maximumFractionDigits: 2 })} MB`);
  const lastError = (health.lastFailed?.details as { error?: string } | null)?.error ?? "?";

  return (
    <main className="mx-auto w-full max-w-5xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-sm text-neutral-500">{t("intro")}</p>

      {health.lastFailed && <ErrorBox>{t("failed", { error: lastError })}</ErrorBox>}
      {!health.lastOk ? (
        <ErrorBox>{t("never")}</ErrorBox>
      ) : health.ok ? (
        <Notice>{t("healthy", { date: when(health.lastOk.startedAt) })}</Notice>
      ) : (
        !health.lastFailed && <ErrorBox>{t("stale", { hours: STALE_AFTER_HOURS })}</ErrorBox>
      )}

      <Section title={t("whereTitle")}>
        <p className="text-sm">{t("where")}</p>
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">{t("offsite")}</p>
      </Section>

      {runs.length === 0 ? (
        <p className="text-sm text-neutral-500">{t("none")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="py-2 pr-4">{t("when")}</th>
                <th className="py-2 pr-4">{t("status")}</th>
                <th className="py-2 pr-4">{t("verified")}</th>
                <th className="py-2 pr-4">{t("contents")}</th>
                <th className="py-2 pr-4">{t("size")}</th>
                <th className="py-2 pr-4">{t("file")}</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => {
                const d = (r.details ?? {}) as { users?: number; auditLog?: number; error?: string };
                const status = (["ok", "failed", "running"].includes(r.status) ? r.status : "running") as "ok";
                return (
                  <tr key={r.id} className="border-b border-neutral-100 align-top dark:border-neutral-900">
                    <td className="whitespace-nowrap py-2 pr-4">{when(r.startedAt)}</td>
                    <td className="py-2 pr-4">
                      <Badge tone={r.status === "ok" ? "green" : r.status === "failed" ? "red" : "amber"}>{t(`statuses.${status}`)}</Badge>
                      {d.error && <div className="mt-1 text-xs text-red-700 dark:text-red-300">{d.error}</div>}
                    </td>
                    <td className="py-2 pr-4">{r.verified ? t("verifiedYes") : t("verifiedNo")}</td>
                    <td className="py-2 pr-4">{d.users !== undefined ? t("contentsLine", { users: d.users, audit: d.auditLog ?? 0 }) : "—"}</td>
                    <td className="py-2 pr-4">{size(r.sizeBytes)}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{r.fileName ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
