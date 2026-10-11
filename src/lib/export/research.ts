import { db } from "@/lib/db";
import { audit, type RequestContext } from "@/lib/audit";
import { bmi, type HistoryData } from "@/lib/history/data";
import { HISTORY_SECTIONS } from "@/lib/history/history";
import { canManageUsers, canSeeSensitiveHistory } from "@/lib/permissions";
import { fingerprint } from "@/lib/secrets";
import { procedureNames } from "@/lib/visits/catalog";
import { loadCatalog } from "@/lib/visits/catalog-db";
import { findingsText } from "@/lib/visits/visits";
import type { VisitArea, VisitProcedure } from "@/lib/visits/visits";
import type { Actor } from "@/lib/users/manage";
import el from "../../../messages/el.json";

// Research export (SPEC §11 "Guest export", Phase 2 step 7d, decided 11 Oct 2026): a
// spreadsheet of clinical data WITHOUT names, contact details, address, AMKA/ΑΦΜ or date
// of birth (age only). Patients appear under a research code that stays the same between
// exports but cannot be traced back without the server's APP_SECRET. Free text (findings,
// diagnosis) may still contain identifying details — the guest's confidentiality
// agreement covers that. Every export is logged.

export type ExportKind = "patients" | "visits";
export const canExportResearch = (actor: Pick<Actor, "level">) => actor.level === "GUEST" || canManageUsers(actor.level);

export const researchCode = (patientId: string) => `R-${fingerprint(patientId, "research-code").slice(0, 10).toUpperCase()}`;

// Semicolon-separated with decimal commas (Greek Excel), UTF-8 with BOM. Cells that a
// spreadsheet would run as a formula (= + - @) get a leading apostrophe.
function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = typeof v === "number" ? String(v).replace(".", ",") : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const toCsv = (rows: unknown[][]) => "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";

const ageOn = (birth: Date | null, now = new Date()) => {
  if (!birth) return null;
  let a = now.getUTCFullYear() - birth.getUTCFullYear();
  if (now.getUTCMonth() < birth.getUTCMonth() || (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate())) a--;
  return a;
};
const month = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens", year: "numeric", month: "2-digit" }).format(d);
const yesNo = (a: string | undefined) => (a === "yes" ? "Ναι" : a === "no" ? "Όχι" : "");
const label = (group: Record<string, string>, k: string) => group[k] ?? k;
const SEX: Record<string, string> = el.patientForm.sexes;

async function patientsOf(companyId: string) {
  return db.patient.findMany({
    where: { companyId, archivedAt: null },
    orderBy: { number: "asc" },
    select: { id: true, birthDate: true, sex: true, riskFactors: true, history: { select: { status: true, currentVersion: { select: { data: true } } } } },
  });
}

export async function researchExport(actor: Actor, companyId: string, kind: ExportKind, ctx: RequestContext): Promise<{ csv: string; rows: number } | null> {
  if (!canExportResearch(actor) || !actor.companyIds.includes(companyId)) return null;
  const sensitive = canSeeSensitiveHistory(actor);
  const questions = await db.historyQuestion.findMany({ where: { companyId, ...(!sensitive && { sensitive: false }) } });
  questions.sort((a, b) => HISTORY_SECTIONS.indexOf(a.section) - HISTORY_SECTIONS.indexOf(b.section) || a.sortOrder - b.sortOrder);
  const patients = await patientsOf(companyId);
  const lastVisit = new Map<string, { weightKg: number | null; heightCm: number | null }>();
  const visits = await db.visit.findMany({
    where: { companyId, patient: { archivedAt: null } },
    orderBy: { startedAt: "asc" },
    select: { patientId: true, startedAt: true, areas: true, procedures: true, diagnosis: true, weightKg: true, heightCm: true, type: { select: { label: true } } },
  });
  for (const v of visits) lastVisit.set(v.patientId, { weightKg: v.weightKg?.toNumber() ?? lastVisit.get(v.patientId)?.weightKg ?? null, heightCm: v.heightCm?.toNumber() ?? lastVisit.get(v.patientId)?.heightCm ?? null });

  // One code per patient, worked out once.
  const codes = new Map<string, string>();
  const code = (id: string) => codes.get(id) ?? (codes.set(id, researchCode(id)), codes.get(id)!);
  let rows: unknown[][];
  if (kind === "patients") {
    const h = el.history;
    const counts = new Map<string, number>();
    for (const v of visits) counts.set(v.patientId, (counts.get(v.patientId) ?? 0) + 1);
    rows = [[
      "research_code", "age", "sex", "bmi", "high_risk", "history_status", "smoking", "medication", "allergies", "visits",
      ...questions.map((q) => `${q.key}: ${q.labelEl}`),
    ]];
    for (const p of patients) {
      const data = (p.history?.currentVersion.data ?? null) as HistoryData | null;
      const lv = lastVisit.get(p.id);
      const b = bmi(lv?.weightKg ?? data?.weightKg, lv?.heightCm ?? data?.heightCm);
      rows.push([
        code(p.id),
        ageOn(p.birthDate),
        p.sex ? SEX[p.sex] : "",
        b ? Math.round(b * 10) / 10 : "",
        p.riskFactors.map((r) => label(h.risk.factors, r)).join(", "),
        p.history?.status === "VERIFIED" ? "επιβεβαιωμένο" : p.history ? "προς επιβεβαίωση" : "",
        !data?.smoking ? "" : data.smoking.a === "no" ? "Όχι" : [label(h.smokingChip, data.smoking.a), data.smoking.perDay].filter(Boolean).join(" "),
        data?.medication ? [yesNo(data.medication.a), ...(data.medication.items ?? []).map((k) => label(h.medItems, k))].filter(Boolean).join(", ") : "",
        data?.allergies ? [yesNo(data.allergies.a), ...(data.allergies.items ?? []).map((k) => label(h.allergyItems, k))].filter(Boolean).join(", ") : "",
        counts.get(p.id) ?? 0,
        ...questions.map((q) => yesNo(data?.answers[q.key]?.a)),
      ]);
    }
  } else {
    const names = procedureNames(await loadCatalog(companyId));
    rows = [["research_code", "month", "visit_type", "procedures", "diagnosis", "findings", "weight_kg", "bmi"]];
    for (const v of visits) {
      const w = v.weightKg?.toNumber() ?? null;
      const b = bmi(w ?? undefined, v.heightCm?.toNumber() ?? lastVisit.get(v.patientId)?.heightCm ?? undefined);
      rows.push([
        code(v.patientId),
        month(v.startedAt),
        v.type?.label ?? "",
        ((v.procedures as VisitProcedure[] | null) ?? []).map((p) => names[p.key] ?? p.key).join(", "),
        v.diagnosis ?? "",
        findingsText(v.areas as VisitArea[] | null) ?? "",
        w ?? "",
        b ? Math.round(b * 10) / 10 : "",
      ]);
    }
  }
  await audit({ action: "export.research", actor, companyId, details: { kind, rows: rows.length - 1, sensitive } }, ctx);
  return { csv: toCsv(rows), rows: rows.length - 1 };
}
