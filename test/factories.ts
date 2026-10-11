import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import type { Level } from "@/generated/prisma/client";
import { encrypt } from "@/lib/secrets";
import { base32Decode, currentStep, generateTotpSecret, hotp } from "@/lib/totp";

let n = 0;
export async function makeUser(
  opts: { level?: Level; password?: string; isActive?: boolean; accessExpiresAt?: Date | null; totp?: boolean } = {},
) {
  n += 1;
  const password = opts.password ?? "test-password-123";
  // 2FA is on by default, like every real account after its first login.
  const totpSecret = opts.totp === false ? undefined : generateTotpSecret();
  const user = await db.user.create({
    data: {
      email: `user${n}-${Date.now()}@example.com`,
      name: `Test User ${n}`,
      passwordHash: await hashPassword(password),
      level: opts.level ?? "USER",
      isActive: opts.isActive ?? true,
      accessExpiresAt: opts.accessExpiresAt ?? null,
      ...(totpSecret && { totpSecretEnc: encrypt(totpSecret, "totp-secret"), totpEnabledAt: new Date() }),
    },
  });
  return { user, password, totpSecret };
}

export const ctx = { ip: "127.0.0.1", userAgent: "vitest" };

// The code an authenticator app would show at `now` (offset in 30 s steps).
export function totpCode(secret: string, now = new Date(), offset = 0) {
  return hotp(base32Decode(secret), currentStep(now) + offset);
}
