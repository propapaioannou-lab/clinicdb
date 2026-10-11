import { NextResponse, type NextRequest } from "next/server";
import { ageToday } from "@/components/patient-bits";
import { getCurrentSession } from "@/lib/auth/current";
import { activeCompany } from "@/lib/company";
import { patientCode } from "@/lib/patients/format";
import { quickSearch } from "@/lib/patients/search";
import { loadActor } from "@/lib/users/manage";

export type SearchResult = {
  id: string;
  number: number;
  code: string;
  name: string;
  fatherName: string | null;
  age: number | null;
  flag: "NONE" | "YELLOW" | "RED";
  infectious: boolean;
  highRisk: boolean;
  company: string;
  phone: string | null;
};

// The search box asks here as you type.
export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const actor = await loadActor(session.user.id);
  const q = req.nextUrl.searchParams.get("q")?.slice(0, 100) ?? "";
  // Only the company chosen in the Ιατρείο | Spa switch.
  const company = await activeCompany(actor);
  const rows = company ? await quickSearch(actor, q, company.id) : [];
  const results: SearchResult[] = rows.map((p) => ({
    id: p.id,
    number: p.number,
    code: patientCode(p.number, p.company.code),
    name: `${p.surname} ${p.firstName}`.trim(),
    fatherName: p.fatherName,
    age: ageToday(p.birthDate)?.years ?? null,
    flag: p.flag,
    infectious: Boolean(p.infectiousDiseases),
    highRisk: p.riskFactors.length > 0,
    company: p.company.name,
    phone: "phones" in p ? (p.phones[0]?.number ?? null) : null,
  }));
  return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
}
