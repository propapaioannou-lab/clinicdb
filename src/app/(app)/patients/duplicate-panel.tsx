"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Badge, primaryButton, secondaryButton, type Tone } from "@/components/ui";
import type { DuplicateCandidate, Strength } from "@/lib/patients/duplicates";
import { patientCode } from "@/lib/patients/format";
import { phoneDigits } from "@/lib/patients/normalize";

export type MergeChoices = { takeNew: string[]; addPhones: string[]; addEmails: string[] };

const COMPARE = ["surname", "firstName", "fatherName", "birthDate", "amka", "afm", "address", "city", "postcode", "occupation"] as const;
const strengthTone: Record<Strength, Tone> = { strong: "red", medium: "amber", weak: "neutral" };

// Same day/month/year format as the form, so equal dates compare equal.
const dmy = (d: Date | string | null) => {
  if (!d) return "";
  const x = new Date(d);
  return `${String(x.getUTCDate()).padStart(2, "0")}/${String(x.getUTCMonth() + 1).padStart(2, "0")}/${x.getUTCFullYear()}`;
};
const normDate = (v: string) => {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v.trim());
  return m ? `${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[3]}` : v;
};
const same = (a: string, b: string) => a.trim().toLocaleLowerCase("el") === b.trim().toLocaleLowerCase("el");

// Side-by-side warning for possible duplicates (SPEC §6b). Warns, never blocks.
export function DuplicatePanel({
  mode,
  duplicates,
  submitted,
  pending,
  onSaveAnyway,
  onMerge,
  onBack,
}: {
  mode: "create" | "edit";
  duplicates: DuplicateCandidate[];
  submitted: FormData;
  pending: boolean;
  onSaveAnyway: (ids: string[]) => void;
  onMerge?: (existingId: string, choices: MergeChoices) => void;
  onBack: () => void;
}) {
  const t = useTranslations("duplicates");
  const tf = useTranslations("patientForm");
  const [comparing, setComparing] = useState<string | null>(null);
  const val = (k: string) => {
    const v = String(submitted.get(k) ?? "");
    return k === "birthDate" ? normDate(v) : v;
  };
  const newPhones = submitted.getAll("phoneNumber").map(String).filter((p) => p.trim());
  const newEmails = submitted.getAll("email").map(String).map((e) => e.trim().toLowerCase()).filter(Boolean);

  return (
    <section className="flex flex-col gap-4 rounded-card border-2 border-warn-line bg-warn-bg/40 p-4 md:p-5">
      <div>
        <h2 className="text-[17px] font-semibold text-warn-ink">{t("title", { count: duplicates.length })}</h2>
        <p className="text-sm text-ink-3">{mode === "create" ? t("introCreate") : t("introEdit")}</p>
      </div>

      {duplicates.map((d) => {
        const existing: Record<string, string> = {
          surname: d.surname, firstName: d.firstName, fatherName: d.fatherName ?? "", birthDate: dmy(d.birthDate),
          amka: d.amka ?? "", afm: d.afm ?? "", address: d.address ?? "", city: d.city ?? "", postcode: d.postcode ?? "",
          occupation: d.occupation ?? "",
        };
        const rows = COMPARE.filter((k) => val(k).trim() && !same(val(k), existing[k]));
        const knownDigits = new Set(d.phones.map((p) => p.digits));
        const extraPhones = newPhones.filter((p) => !knownDigits.has(phoneDigits(p)));
        const extraEmails = newEmails.filter((e) => !d.emails.some((x) => x.email === e));
        const open = comparing === d.id;
        return (
          <article key={d.id} className="flex flex-col gap-3 rounded-[14px] border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-semibold">{d.surname} {d.firstName}</span>
              <span className="text-sm text-muted">· {patientCode(d.number, d.company.code)}</span>
              <Badge tone={strengthTone[d.strength]}>{t(`strength.${d.strength}`)}</Badge>
              {d.reasons.map((r) => <Badge key={r} tone="info">{t(`reasons.${r}`)}</Badge>)}
            </div>
            <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
              {d.fatherName && <Item label={tf("fatherName")} value={d.fatherName} />}
              {d.birthDate && <Item label={tf("birthDate")} value={new Date(d.birthDate).toLocaleDateString("el-GR", { timeZone: "UTC" })} />}
              {d.amka && <Item label={tf("amka")} value={d.amka} />}
              {d.phones.length > 0 && <Item label={tf("phones")} value={d.phones.map((p) => p.number).join(", ")} />}
              {d.emails.length > 0 && <Item label={tf("emails")} value={d.emails.map((e) => e.email).join(", ")} />}
              {(d.address || d.city) && <Item label={tf("addressGroup")} value={[d.address, d.city].filter(Boolean).join(", ")} />}
              <Item label={t("registered")} value={new Date(d.registeredAt).toLocaleDateString("el-GR")} />
            </dl>
            <div className="flex flex-wrap gap-2">
              {onMerge && !open && (
                <button type="button" onClick={() => setComparing(d.id)} className={secondaryButton}>{t("samePerson")}</button>
              )}
              <a href={`/patients/${d.id}`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center px-2 text-sm font-semibold text-primary hover:text-primary-hover">
                {t("openRecord")} ↗
              </a>
            </div>

            {open && onMerge && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  onMerge(d.id, {
                    takeNew: rows.filter((k) => fd.get(`pick-${k}`) === "new"),
                    addPhones: fd.getAll("addPhone").map(String),
                    addEmails: fd.getAll("addEmail").map(String),
                  });
                }}
                className="flex flex-col gap-3 border-t border-line-soft pt-3"
              >
                <p className="text-sm text-ink-3">{t("mergeIntro")}</p>
                {rows.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-left text-sm">
                      <thead className="text-xs text-muted">
                        <tr><th className="py-1.5 pr-3 font-semibold">{t("field")}</th><th className="py-1.5 pr-3 font-semibold">{t("existing")}</th><th className="py-1.5 font-semibold">{t("typed")}</th></tr>
                      </thead>
                      <tbody>
                        {rows.map((k) => {
                          const def = existing[k] ? "old" : "new";
                          return (
                            <tr key={k} className="border-t border-line-softer">
                              <td className="py-2 pr-3 text-muted">{tf(k)}</td>
                              <td className="py-2 pr-3">
                                <label className="flex items-center gap-2"><input type="radio" name={`pick-${k}`} value="old" defaultChecked={def === "old"} disabled={!existing[k]} className="accent-primary" />{existing[k] || "—"}</label>
                              </td>
                              <td className="py-2">
                                <label className="flex items-center gap-2"><input type="radio" name={`pick-${k}`} value="new" defaultChecked={def === "new"} className="accent-primary" />{val(k)}</label>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {extraPhones.map((p) => (
                  <label key={p} className="flex items-center gap-2 text-sm"><input type="checkbox" name="addPhone" value={p} defaultChecked className="accent-primary" />{t("addPhone", { phone: p })}</label>
                ))}
                {extraEmails.map((e) => (
                  <label key={e} className="flex items-center gap-2 text-sm"><input type="checkbox" name="addEmail" value={e} defaultChecked className="accent-primary" />{t("addEmail", { email: e })}</label>
                ))}
                <p className="text-xs text-muted">{t("mergeNote")}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" disabled={pending} className={primaryButton}>{t("updateExisting")}</button>
                  <button type="button" onClick={() => setComparing(null)} className={secondaryButton}>{t("cancelCompare")}</button>
                </div>
              </form>
            )}
          </article>
        );
      })}

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => onSaveAnyway(duplicates.map((d) => d.id))} className={secondaryButton}>
          {mode === "create" ? t("createAnyway") : t("saveAnyway")}
        </button>
        <button type="button" disabled={pending} onClick={onBack} className="inline-flex h-11 items-center px-3 text-sm font-medium text-ink-3 hover:text-ink">
          {t("back")}
        </button>
      </div>
    </section>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
}
