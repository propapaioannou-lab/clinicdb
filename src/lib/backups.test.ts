import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { backupHealth } from "./backups";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600 * 1000);

describe("backup health (drives the red warning bar)", () => {
  beforeEach(async () => {
    await db.backupRun.deleteMany({});
  });

  it("warns when there has never been a backup", async () => {
    expect((await backupHealth()).ok).toBe(false);
  });

  it("is fine with a good backup from last night", async () => {
    await db.backupRun.create({ data: { status: "ok", startedAt: hoursAgo(8), verified: true } });
    expect((await backupHealth()).ok).toBe(true);
  });

  it("warns when the last good backup is older than 26 hours", async () => {
    await db.backupRun.create({ data: { status: "ok", startedAt: hoursAgo(27), verified: true } });
    expect((await backupHealth()).ok).toBe(false);
  });

  it("warns when the latest run failed, even if an earlier one was fine", async () => {
    await db.backupRun.create({ data: { status: "ok", startedAt: hoursAgo(20), verified: true } });
    await db.backupRun.create({ data: { status: "failed", startedAt: hoursAgo(1), details: { error: "disk full" } } });
    const h = await backupHealth();
    expect(h.ok).toBe(false);
    expect(h.lastFailed?.details).toMatchObject({ error: "disk full" });
  });
});
