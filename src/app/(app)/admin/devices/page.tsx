import { getTranslations } from "next-intl/server";
import { listActiveSessions } from "@/lib/users/queries";
import { requireManager } from "../guard";
import { SessionTable } from "./session-table";

export default async function DevicesPage() {
  const { session } = await requireManager();
  const rows = await listActiveSessions();
  const t = await getTranslations("admin.devices");
  return (
    <main className="mx-auto w-full max-w-6xl p-4">
      <h1 className="mb-4 text-2xl font-semibold">{t("overviewTitle")}</h1>
      <SessionTable rows={rows} currentSessionId={session.sessionId} returnTo="/admin/devices" />
    </main>
  );
}
