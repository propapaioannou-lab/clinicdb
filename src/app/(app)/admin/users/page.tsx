import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge, primaryButton } from "@/components/ui";
import { listUsers, type UserStatus } from "@/lib/users/queries";
import { requireManager } from "../guard";

const statusTone: Record<UserStatus, "green" | "amber" | "red" | "neutral"> = {
  active: "green", invited: "amber", locked: "red", expired: "neutral", inactive: "neutral",
};

export default async function UsersPage() {
  await requireManager();
  const users = await listUsers();
  const t = await getTranslations("admin");
  const tl = await getTranslations("levels");
  const format = await getFormatter();
  const date = (d: Date) => format.dateTime(d, { day: "numeric", month: "short", year: "numeric" });

  return (
    <main className="mx-auto w-full max-w-6xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("users.title")}</h1>
        <div className="flex items-center gap-4">
          <Link href="/admin/users/deleted" className="text-sm underline-offset-2 hover:underline">{t("deleted.link")}</Link>
          <Link href="/admin/users/new" className={`${primaryButton} w-auto`}>{t("users.new")}</Link>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
            <tr>
              <th className="py-2 pr-4">{t("users.name")}</th>
              <th className="py-2 pr-4">{t("users.level")}</th>
              <th className="py-2 pr-4">{t("users.companies")}</th>
              <th className="py-2 pr-4">{t("users.status")}</th>
              <th className="py-2 pr-4">{t("users.twoFactor")}</th>
              <th className="py-2 pr-4">{t("users.lastLogin")}</th>
              <th className="py-2 pr-4">{t("users.devices")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-neutral-100 dark:border-neutral-900">
                <td className="py-2 pr-4">
                  <Link href={`/admin/users/${u.id}`} className="font-medium underline-offset-2 hover:underline">{u.name}</Link>
                  <div className="text-xs text-neutral-500">{u.email}</div>
                </td>
                <td className="py-2 pr-4">
                  {tl(u.level)}
                  {u.level === "GUEST" && u.accessExpiresAt && (
                    <div className="text-xs text-neutral-500">{t("users.until", { date: date(u.accessExpiresAt) })}</div>
                  )}
                </td>
                <td className="py-2 pr-4">{u.companies.join(", ")}</td>
                <td className="py-2 pr-4"><Badge tone={statusTone[u.status]}>{t(`status.${u.status}`)}</Badge></td>
                <td className="py-2 pr-4">{u.twoFactor ? t("users.yes") : t("users.no")}</td>
                <td className="py-2 pr-4">{u.lastLoginAt ? date(u.lastLoginAt) : t("users.never")}</td>
                <td className="py-2 pr-4">{u.activeSessions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
