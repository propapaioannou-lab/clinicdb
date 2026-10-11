import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import type { Level } from "@/generated/prisma/client";

let n = 0;
export async function makeUser(opts: { level?: Level; password?: string; isActive?: boolean; accessExpiresAt?: Date | null } = {}) {
  n += 1;
  const password = opts.password ?? "test-password-123";
  const user = await db.user.create({
    data: {
      email: `user${n}-${Date.now()}@example.com`,
      name: `Test User ${n}`,
      passwordHash: await hashPassword(password),
      level: opts.level ?? "USER",
      isActive: opts.isActive ?? true,
      accessExpiresAt: opts.accessExpiresAt ?? null,
    },
  });
  return { user, password };
}

export const ctx = { ip: "127.0.0.1", userAgent: "vitest" };
