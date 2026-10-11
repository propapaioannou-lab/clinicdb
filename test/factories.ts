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

export async function companies() {
  const surgery = await db.company.upsert({ where: { code: "surgery" }, update: {}, create: { code: "surgery", name: "Surgery" } });
  const spa = await db.company.upsert({ where: { code: "spa" }, update: {}, create: { code: "spa", name: "Spa" } });
  return { surgery: surgery.id, spa: spa.id };
}

// An Actor for the user-management service, with company access.
export async function makeActor(level: Level, companyIds: string[]) {
  // Guests always have an end date (the database insists).
  const accessExpiresAt = level === "GUEST" ? new Date(Date.now() + 86_400_000) : null;
  const { user } = await makeUser({ level, accessExpiresAt });
  await db.membership.createMany({ data: companyIds.map((companyId) => ({ userId: user.id, companyId })) });
  return { id: user.id, email: user.email, name: user.name, level, companyIds };
}

// Latest email to `to` in the local test mailbox (Mailpit), or null.
export async function lastMailTo(to: string): Promise<{ subject: string; text: string } | null> {
  const base = `http://${process.env.SMTP_HOST ?? "mail"}:8025/api/v1`;
  const search = await fetch(`${base}/search?query=${encodeURIComponent(`to:"${to}"`)}`).then((r) => r.json());
  const id = search.messages?.[0]?.ID;
  if (!id) return null;
  const msg = await fetch(`${base}/message/${id}`).then((r) => r.json());
  return { subject: msg.Subject, text: msg.Text };
}

let patientNo = 100000;
// A fake patient with derived search fields filled in, as the app would store it.
export async function makePatient(
  companyId: string,
  p: { surname: string; firstName?: string; birthDate?: Date; amka?: string; phones?: string[]; emails?: string[]; archived?: boolean; number?: number },
) {
  const { patientSearchName, patientSortName, phoneDigits, normalizeEmail } = await import("@/lib/patients/normalize");
  patientNo += 1;
  return db.patient.create({
    data: {
      companyId,
      number: p.number ?? patientNo,
      surname: p.surname,
      firstName: p.firstName ?? "",
      searchName: patientSearchName(p),
      sortName: patientSortName(p),
      birthDate: p.birthDate ?? null,
      amka: p.amka ?? null,
      archivedAt: p.archived ? new Date() : null,
      phones: { create: (p.phones ?? []).map((n, i) => ({ companyId, number: n, digits: phoneDigits(n), isMain: i === 0, sortOrder: i })) },
      emails: { create: (p.emails ?? []).map((e, i) => ({ companyId, email: normalizeEmail(e), sortOrder: i })) },
    },
  });
}
