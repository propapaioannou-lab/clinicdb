"use client";

import { useTranslations } from "next-intl";
import type { MeasureValue } from "@/lib/visits/exams/engine";

// Standard eyelid diagram (decided 11 Oct 2026): both eyes with brow, lid crease, lid
// margins and the corneal light reflex; MRD1 / MRD2 / MCD drawn as lines with their
// values, LF and TPS written under each eye. Values come from the table beside it.
// Patient's right eye (Δ) is on the viewer's left. viewBox 560 × 230.
const CY = 120;
const show = (n: number | undefined) => (n === undefined ? "—" : String(n).replace(".", ","));

function Eye({ cx, side, values }: { cx: number; side: "r" | "l"; values: Record<string, MeasureValue> }) {
  const v = (k: string) => show(values[k]?.[side]);
  // The lateral canthus sits slightly higher; mirror for the left eye.
  const s = side === "r" ? 1 : -1;
  const x = (dx: number) => cx + s * dx;
  return (
    <g>
      <path d={`M${x(-85)} 48 Q${x(0)} -4 ${x(90)} 40`} fill="none" stroke="var(--color-ink-3)" strokeWidth="5" strokeLinecap="round" opacity="0.55" />
      <path d={`M${x(-75)} 112 Q${x(0)} 22 ${x(75)} 108`} fill="none" stroke="var(--color-ink-3)" strokeWidth="1.4" />
      <path d={`M${x(-80)} 122 Q${x(0)} 62 ${x(80)} 118 Q${x(0)} 162 ${x(-80)} 122 Z`} fill="var(--color-surface)" stroke="var(--color-ink-2)" strokeWidth="2" />
      <circle cx={cx} cy={CY} r="20" fill="none" stroke="var(--color-ink-3)" strokeWidth="1.4" />
      <circle cx={cx} cy={CY} r="7" fill="var(--color-ink-3)" opacity="0.6" />
      <circle cx={cx} cy={CY} r="2.5" fill="var(--color-primary)" />
      <g stroke="var(--color-primary)" strokeWidth="1.6" strokeDasharray="4 3">
        <line x1={cx} y1={CY} x2={cx} y2="92" />
        <line x1={cx} y1={CY} x2={cx} y2="141" />
        <line x1={x(32)} y1="97" x2={x(32)} y2="72" />
      </g>
      {/* MRD labels on the temple side, MCD on the nose side, mirrored per eye. */}
      <g fontSize="14" fill="var(--color-primary)" fontWeight="600">
        <text x={x(-8)} y="86" textAnchor={side === "r" ? "end" : "start"}>MRD1 {v("mrd1")}</text>
        <text x={x(-8)} y="160" textAnchor={side === "r" ? "end" : "start"}>MRD2 {v("mrd2")}</text>
        <text x={x(40)} y="68" textAnchor={side === "r" ? "start" : "end"}>MCD {v("mcd")}</text>
      </g>
      <text x={cx} y="196" fontSize="14" fill="var(--color-ink-3)" textAnchor="middle">
        LF {v("lf")} · TPS {v("tps")}
      </text>
    </g>
  );
}

export function EyeSketch({ values }: { values: Record<string, MeasureValue> }) {
  const t = useTranslations("exam");
  return (
    <svg viewBox="0 0 560 230" role="img" aria-label={t("eyeSketch")} className="mx-auto w-full max-w-[560px] rounded-[10px] border border-line-soft bg-surface">
      <text x="14" y="222" fontSize="13" fill="var(--color-muted)">{t("right")}</text>
      <text x="546" y="222" fontSize="13" fill="var(--color-muted)" textAnchor="end">{t("left")}</text>
      <Eye cx={150} side="r" values={values} />
      <Eye cx={410} side="l" values={values} />
      <text x="280" y="222" fontSize="11.5" fill="var(--color-muted)" textAnchor="middle">mm</text>
    </svg>
  );
}
