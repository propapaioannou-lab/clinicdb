// ONLINE DEMO only (DEMO_MODE=1, run by scripts/demo-build.sh on every Render build):
//   npx tsx scripts/demo-seed.ts users          the two demo logins (passwords from the hosting settings)
//   npx tsx scripts/demo-seed.ts calendar-week  prints this week's Monday when the fake calendar
//                                               needs filling (none yet, or under a week left)
// Fake data only. Refuses to run anywhere else.
import { db } from "../src/lib/db";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../src/lib/password";

const USERS = [
  { env: "DEMO_SECRETARY_PASSWORD", email: "grammateia@example.com", name: "Γραμματεία Δοκιμή", level: "USER", role: "SECRETARY" },
  { env: "DEMO_PHYSICIAN_PASSWORD", email: "giatros@example.com", name: "Δρ Δοκιμή", level: "OWNER", role: "SURGEON" },
] as const;

async function users() {
  const companies = await db.company.findMany();
  if (!companies.length) throw new Error("No companies: run `npx prisma db seed` first.");
  for (const u of USERS) {
    const password = process.env[u.env] ?? "";
    if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`${u.env} is missing or shorter than ${MIN_PASSWORD_LENGTH} characters (Render → Environment).`);
    // Every build sets the password from the settings, so changing it there is enough.
    const data = { name: u.name, level: u.level, role: u.role, passwordHash: await hashPassword(password), isActive: true, failedLogins: 0, lockedUntil: null, accessExpiresAt: null };
    const user = await db.user.upsert({ where: { email: u.email }, update: data, create: { email: u.email, ...data } });
    for (const c of companies) {
      await db.membership.upsert({ where: { userId_companyId: { userId: user.id, companyId: c.id } }, update: {}, create: { userId: user.id, companyId: c.id } });
    }
    // The physician gets the practice's doctor column (own calendar, «ready in room» banner).
    const practice = companies.find((c) => c.code === "surgery");
    if (u.role === "SURGEON" && practice) {
      await db.resource.updateMany({ where: { companyId: practice.id, kind: "DOCTOR", userId: null }, data: { userId: user.id, label: u.name } });
    }
    console.log(`demo login ready: ${u.email}`);
  }
}

async function calendarWeek() {
  const soon = new Date(Date.now() + 7 * 24 * 3600e3);
  const left = await db.appointment.count({ where: { startsAt: { gt: soon }, events: { some: { action: "created", byName: "seed" } } } });
  if (left > 0) return;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  process.stdout.write(d.toISOString().slice(0, 10));
}

async function main() {
  if (process.env.DEMO_MODE !== "1") throw new Error("Refusing: this is for the online demo only (DEMO_MODE=1).");
  const what = process.argv[2];
  if (what === "users") await users();
  else if (what === "calendar-week") await calendarWeek();
  else throw new Error("Usage: demo-seed.ts users | calendar-week");
}

main()
  .catch((e) => {
    console.error("Error:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
