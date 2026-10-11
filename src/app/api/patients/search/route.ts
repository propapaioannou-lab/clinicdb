import { NextResponse, type NextRequest } from "next/server";
import { ageToday } from "@/components/patient-bits";
import { getCurrentSession } from "@/lib/auth/current";
import { quickSearch } from "@/lib/patients/search";
import { loadActor } from "@/lib/users/manage";

export type SearchResult = {
  id: string;
  number: number;
  name: string;
  fatherName: string | null;
  age: number | null;
  flag: "NONE" | "YELLOW" | "RED";
  infectious: boolean;
  company: string;
  phone: string | null;
};

// The search box asks here as you type.
export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const actor = await loadActor(session.user.id);
  const q = req.nextUrl.searchParams.get("q")?.slice(0, 100) ?? "";
  const rows = await quickSearch(actor, q);
  const results: SearchResult[] = rows.map((p) => ({
    id: p.id,
    number: p.number,
    name: `${p.surname} ${p.firstName}`.trim(),
    fatherName: p.fatherName,
    age: ageToday(p.birthDate)?.years ?? null,
    flag: p.flag,
    infectious: Boolean(p.infectiousDiseases),
    company: p.company.name,
    phone: "phones" in p ? (p.phones[0]?.number ?? null) : null,
  }));
  return NextResponse.json({ results, multiCompany: actor.companyIds.length > 1 }, { headers: { "Cache-Control": "no-store" } });
}
