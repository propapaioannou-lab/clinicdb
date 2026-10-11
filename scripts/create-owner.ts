// Bootstrap only: creates (or resets) an Owner with access to every company.
// Everyone else is invited from the app (SPEC §11).
// Run: podman compose exec app npx tsx scripts/create-owner.ts
import { createInterface } from "node:readline";
import { db } from "../src/lib/db";
import { generatePassword, hashPassword, MIN_PASSWORD_LENGTH } from "../src/lib/password";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: Boolean(process.stdin.isTTY),
});
let hideInput = false;
// While a password is typed, show only the prompt, never the characters.
const rlOut = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WritableStream };
rlOut._writeToOutput = (s) => {
  if (!hideInput) rlOut.output.write(s);
};
const lines = rl[Symbol.asyncIterator]();

async function ask(question: string, hidden = false): Promise<string> {
  process.stdout.write(question);
  hideInput = hidden;
  const { value } = await lines.next();
  hideInput = false;
  if (hidden) process.stdout.write("\n");
  return String(value ?? "").trim();
}

async function main() {
  const companies = await db.company.findMany();
  if (companies.length === 0) throw new Error("No companies. Run: npx prisma db seed");

  const email = (await ask("Email: ")).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Invalid email.");
  const name = await ask("Full name: ");
  if (!name) throw new Error("Name is required.");
  let password = await ask(
    `Password (min ${MIN_PASSWORD_LENGTH} characters, or press Enter to generate one): `,
    true,
  );
  const generated = password === "";
  if (generated) {
    password = generatePassword();
  } else {
    if (password.length < MIN_PASSWORD_LENGTH) throw new Error("Password too short.");
    if ((await ask("Repeat password: ", true)) !== password) throw new Error("Passwords differ.");
  }

  const passwordHash = await hashPassword(password);
  const user = await db.user.upsert({
    where: { email },
    update: { name, passwordHash, level: "OWNER", isActive: true, accessExpiresAt: null },
    create: { email, name, passwordHash, level: "OWNER" },
  });
  for (const c of companies) {
    await db.membership.upsert({
      where: { userId_companyId: { userId: user.id, companyId: c.id } },
      update: {},
      create: { userId: user.id, companyId: c.id },
    });
  }
  console.log(`Owner ready: ${email} (companies: ${companies.map((c) => c.code).join(", ")})`);
  if (generated) {
    console.log(`\nGenerated password (shown once, write it down or save it in a password manager):\n\n    ${password}\n`);
  }
}

main()
  .catch((e) => {
    console.error("Error:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => {
    rl.close();
    return db.$disconnect();
  });
