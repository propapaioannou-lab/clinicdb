"use client";

import { useTranslations } from "next-intl";
import type { MeasureValue } from "@/lib/visits/exams/engine";
import { NumberBox, putSide } from "./fields-editor";

// Front-view breast evaluation sketch (consultation-sheet style): the basic measurements
// are drawn as lines with a box on each; the boxes are the same values as the table.
// Patient's right (Δ) is on the viewer's left. viewBox 300 × 300.
type Spot = { key: string; side: "r" | "l" | "v"; x: number; y: number; tag: string };
const mirror = (x: number) => 300 - x;
const pair = (key: string, x: number, y: number, tag: string): Spot[] => [
  { key, side: "r", x, y, tag },
  { key, side: "l", x: mirror(x), y, tag },
];
const SPOTS: Spot[] = [
  ...pair("jmd", 104, 104, "JMD"),
  ...pair("nml", 121, 182, "N–ML"),
  ...pair("nimfStretch", 62, 228, "N–IMF"),
  ...pair("bw", 91, 288, "BW"),
  ...pair("areola", 56, 176, "άλως"),
  { key: "intermammary", side: "v", x: 150, y: 256, tag: "IMD" },
];
const NIPPLE = { x: 92, y: 195 };
const breast = (x: (n: number) => number) => `M${x(45)} 140 C${x(40)} 215 ${x(78)} 255 ${x(92)} 255 C${x(110)} 255 ${x(140)} 228 ${x(136)} 160`;

export function BreastSketch({
  values,
  names,
  onChange,
  missing,
}: {
  values: Record<string, MeasureValue>;
  names: Record<string, string>;
  onChange: (key: string, v: MeasureValue | undefined) => void;
  missing: string[];
}) {
  const t = useTranslations("exam");
  const sideName = (s: Spot["side"]) => (s === "r" ? ` ${t("right")}` : s === "l" ? ` ${t("left")}` : "");
  const both = (d: (x: (n: number) => number) => React.ReactNode) => (
    <>
      {d((n) => n)}
      {d(mirror)}
    </>
  );
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[320px] shrink-0 rounded-[10px] border border-line-soft bg-surface">
      <svg viewBox="0 0 300 300" aria-hidden="true" className="absolute inset-0 h-full w-full">
        <g fill="none" stroke="var(--color-ink-3)" strokeWidth="1.6" strokeLinecap="round">
          {both((x) => <path d={`M${x(132)} 0 L${x(133)} 26 Q${x(100)} 34 ${x(42)} 46 L${x(36)} 300`} />)}
          {both((x) => <path d={breast(x)} />)}
          {both((x) => <circle cx={x(NIPPLE.x)} cy={NIPPLE.y} r="9" />)}
        </g>
        <g stroke="var(--color-primary)" strokeWidth="1.4" strokeDasharray="4 3" fill="none">
          <circle cx="150" cy="28" r="2.5" fill="var(--color-primary)" stroke="none" />
          {both((x) => <line x1="150" y1="28" x2={x(NIPPLE.x)} y2={NIPPLE.y} />)}
          {both((x) => <line x1={x(NIPPLE.x)} y1={NIPPLE.y} x2="150" y2={NIPPLE.y} />)}
          {both((x) => <line x1={x(NIPPLE.x)} y1={NIPPLE.y} x2={x(NIPPLE.x)} y2="255" />)}
          {both((x) => <line x1={x(45)} y1="272" x2={x(137)} y2="272" />)}
          <line x1="136" y1="240" x2="164" y2="240" />
          <line x1="150" y1="20" x2="150" y2="300" strokeDasharray="2 4" stroke="var(--color-line-strong)" />
        </g>
        <text x="14" y="18" fontSize="13" fill="var(--color-muted)">{t("right")}</text>
        <text x="286" y="18" fontSize="13" fill="var(--color-muted)" textAnchor="end">{t("left")}</text>
      </svg>
      {SPOTS.map((s) => {
        const v = values[s.key];
        const n = s.side === "v" ? v?.v : v?.[s.side];
        return (
          <div key={`${s.key}${s.side}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${(s.x / 300) * 100}%`, top: `${(s.y / 300) * 100}%` }}>
            <NumberBox
              value={n}
              onChange={(x) => onChange(s.key, putSide(v, s.side, x))}
              label={`${names[s.key]}${sideName(s.side)}`}
              placeholder={s.tag}
              className={`h-7 w-[52px] rounded-[6px] border bg-surface/95 px-0.5 text-center text-[12.5px] placeholder:text-[11px] placeholder:text-muted focus:border-primary focus:outline-none ${missing.includes(s.key) && n === undefined ? "border-warn-line" : "border-line-strong"}`}
            />
          </div>
        );
      })}
    </div>
  );
}

