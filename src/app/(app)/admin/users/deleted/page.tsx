import { BackLink } from "@/components/back-link";
import { backLabel } from "@/components/back-label";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { listDeletedUsers } from "@/lib/users/queries";
import { requireManager } from "../../guard";

export default async function DeletedUsersPage() {
  await requireManager();
  const rows = await listDeletedUsers();
  const t = await getTranslations("admin.deleted");
  const tu = await getTranslations("admin.users");
  const tl = await getTranslations("levels");
  const ta = await getTranslations("audit");
  const format = await getFormatter();
  const date = (d: Date) => format.dateTime(d, { day: "numeric", month: "short", year: "numeric" });

  return (
    <main className="mx-auto w-full max-w-6xl p-4">
      <BackLink href="/admin/users" label={await backLabel("users")} />
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <Link href="/admin/users" className="text-sm underline-offset-2 hover:underline">{tu("title")}</Link>
      </div>
      <p className="mb-4 text-sm text-neutral-500">{t("intro")}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">{t("none")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="py-2 pr-4">{t("name")}</th>
                <th className="py-2 pr-4">{t("level")}</th>
                <th className="py-2 pr-4">{t("companies")}</th>
                <th className="py-2 pr-4">{t("created")}</th>
                <th className="py-2 pr-4">{t("deletedAt")}</th>
                <th className="py-2 pr-4">{t("deletedBy")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-b border-neutral-100 dark:border-neutral-900">
                  <td className="py-2 pr-4">
                    <span className="font-medium">{u.name}</span>
                    <div className="text-xs text-neutral-500">{u.email}</div>
                    <Link href={`/admin/audit?user=${u.userId}`} className="text-xs underline-offset-2 hover:underline">{ta("history")}</Link>
                  </td>
                  <td className="py-2 pr-4">{tl(u.level)}</td>
                  <td className="py-2 pr-4">{u.companies.join(", ")}</td>
                  <td className="py-2 pr-4">{date(u.createdAt)}</td>
                  <td className="py-2 pr-4">{date(u.deletedAt)}</td>
                  <td className="py-2 pr-4">{u.deletedByEmail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
