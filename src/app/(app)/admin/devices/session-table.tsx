import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { secondaryButton } from "@/components/ui";
import { describeDevice } from "@/lib/user-agent";
import { endSessionAction } from "../actions";

type Row = {
  id: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  ip: string | null;
  userAgent: string | null;
  viaTrustedDevice?: boolean;
  user?: { id: string; name: string };
};

// Logged-in browsers with an "End" button. Used per user and in the overview.
export async function SessionTable({ rows, currentSessionId, returnTo }: { rows: Row[]; currentSessionId: string; returnTo: string }) {
  const t = await getTranslations("admin.devices");
  const format = await getFormatter();
  const when = (d: Date) => format.dateTime(d, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  if (rows.length === 0) return <p className="text-sm text-neutral-500">{t("none")}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
          <tr>
            {rows[0].user && <th className="py-2 pr-4">{t("user")}</th>}
            <th className="py-2 pr-4">{t("device")}</th>
            <th className="py-2 pr-4">{t("ip")}</th>
            <th className="py-2 pr-4">{t("since")}</th>
            <th className="py-2 pr-4">{t("lastSeen")}</th>
            <th className="py-2 pr-4">{t("ends")}</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className="border-b border-neutral-100 dark:border-neutral-900">
              {s.user && (
                <td className="py-2 pr-4">
                  <Link href={`/admin/users/${s.user.id}`} className="underline-offset-2 hover:underline">{s.user.name}</Link>
                </td>
              )}
              <td className="py-2 pr-4">
                {describeDevice(s.userAgent)}
                {s.id === currentSessionId && <span className="ml-1 text-neutral-500">{t("thisDevice")}</span>}
                {s.viaTrustedDevice && <div className="text-xs text-neutral-500">{t("viaTrusted")}</div>}
              </td>
              <td className="py-2 pr-4 font-mono text-xs">{s.ip ?? "—"}</td>
              <td className="py-2 pr-4">{when(s.createdAt)}</td>
              <td className="py-2 pr-4">{when(s.lastSeenAt)}</td>
              <td className="py-2 pr-4">{when(s.expiresAt)}</td>
              <td className="py-2 text-right">
                <form action={endSessionAction.bind(null, s.id, returnTo)}>
                  <button type="submit" className={secondaryButton}>{t("end")}</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
