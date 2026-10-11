// Reference data only. Never real patient data.
import { db } from "../src/lib/db";

const companies = [
  { code: "surgery", name: "Πλαστική Χειρουργική" },
  { code: "spa", name: "Medical Spa" },
];

async function main() {
  for (const c of companies) {
    await db.company.upsert({ where: { code: c.code }, update: {}, create: c });
  }
  console.log(`Companies ready: ${companies.map((c) => c.code).join(", ")}`);
}

main().finally(() => db.$disconnect());
