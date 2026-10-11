// Emergency: someone lost their phone AND recovery codes. Removes their 2FA,
// trusted devices and open sessions; they set up 2FA again at next login.
// Run: podman compose exec app npx tsx scripts/reset-2fa.ts name@example.com
import { db } from "../src/lib/db";
import { resetTwoFactor } from "../src/lib/auth/reset-two-factor";

async function main() {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  if (!email) throw new Error("Usage: npx tsx scripts/reset-2fa.ts name@example.com");
  const user = await db.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No user with email ${email}`);
  await resetTwoFactor(user.id, { email: "server-script" }, { ip: null, userAgent: "scripts/reset-2fa.ts" });
  console.log(`2FA reset for ${email}. They will set it up again at their next login.`);
}

main()
  .catch((e) => {
    console.error("Error:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
