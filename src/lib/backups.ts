import { db } from "@/lib/db";

// A backup runs nightly at 02:30; allow a margin before warning.
export const STALE_AFTER_HOURS = 26;

export async function backupHealth(now = new Date()) {
  const [lastOk, lastRun] = await Promise.all([
    db.backupRun.findFirst({ where: { status: "ok" }, orderBy: { startedAt: "desc" } }),
    db.backupRun.findFirst({ orderBy: { startedAt: "desc" } }),
  ]);
  const stale = !lastOk || now.getTime() - lastOk.startedAt.getTime() > STALE_AFTER_HOURS * 3600 * 1000;
  return { lastOk, lastFailed: lastRun?.status === "failed" ? lastRun : null, ok: !stale && lastRun?.status !== "failed" };
}

export async function listBackupRuns(limit = 30) {
  return db.backupRun.findMany({ orderBy: { startedAt: "desc" }, take: limit });
}
