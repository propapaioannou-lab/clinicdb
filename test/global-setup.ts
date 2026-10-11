// Creates a fresh, empty test database and applies all migrations to it.
// Tests never touch the development database.
import { execSync } from "node:child_process";
import { Client } from "pg";

export default async function setup() {
  const main = new URL(process.env.DATABASE_URL!);
  const testUrl = new URL(main);
  testUrl.pathname = `${main.pathname}_test`;
  const name = testUrl.pathname.slice(1);

  const admin = new Client({ connectionString: main.toString() });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${name}"`);
  await admin.end();

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: testUrl.toString() },
    stdio: "ignore",
  });
  process.env.TEST_DATABASE_URL = testUrl.toString();

  // Afterwards: remove the test emails from the local mailbox (all go to @example.com).
  return async () => {
    const base = `http://${process.env.SMTP_HOST ?? "mail"}:8025/api/v1`;
    await fetch(`${base}/search?query=${encodeURIComponent("to:@example.com")}`, { method: "DELETE" }).catch(() => {});
  };
}
