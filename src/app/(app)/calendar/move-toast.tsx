"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { moveNotifyAction, undoMoveAction } from "./actions";
import type { MovedEvent } from "./drag-surface";

const UNDO_SECONDS = 10;

// After a move (DESIGN 6g panel 3): «Μετακινήθηκε → Πεμ 15/10 · 19:55» with «Αναίρεση · 8″»
// and «☑ Ενημέρωση ασθενούς» (on by default; sending comes with GHL, 6d). A refused drop
// shows why instead.
export function MoveToast() {
  const t = useTranslations("calendar.move");
  const router = useRouter();
  const [moved, setMoved] = useState<(MovedEvent & { until: number; notify: boolean }) | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const onMoved = (e: Event) => {
      setFailed(null);
      setMoved({ ...(e as CustomEvent<MovedEvent>).detail, until: Date.now() + UNDO_SECONDS * 1000, notify: true });
    };
    const onFailed = (e: Event) => {
      setFailed((e as CustomEvent<string>).detail);
      setTimeout(() => setFailed(null), 6000);
    };
    window.addEventListener("clinic:moved", onMoved);
    window.addEventListener("clinic:move-failed", onFailed);
    return () => {
      window.removeEventListener("clinic:moved", onMoved);
      window.removeEventListener("clinic:move-failed", onFailed);
    };
  }, []);
  useEffect(() => {
    if (!moved) return;
    const id = setInterval(() => {
      setNow(Date.now());
      if (Date.now() > moved.until) setMoved(null);
    }, 250);
    return () => clearInterval(id);
  }, [moved]);

  if (failed)
    return (
      <div role="alert" className="fixed bottom-6 left-1/2 z-[70] max-w-[min(560px,calc(100vw-24px))] -translate-x-1/2 rounded-[12px] bg-danger px-4 py-3 text-[14px] text-white shadow-[0_12px_32px_rgba(28,32,36,0.3)]">
        {t("notMoved")}: {failed}
        <div className="text-[12.5px] opacity-90">{t("notMovedHint")}</div>
      </div>
    );
  if (!moved) return null;
  const left = Math.max(0, Math.ceil((moved.until - now) / 1000));
  return (
    <div role="status" className="fixed bottom-6 left-1/2 z-[70] flex w-[min(520px,calc(100vw-24px))] -translate-x-1/2 flex-col gap-1.5 rounded-[12px] bg-ink px-4 py-3 text-white shadow-[0_12px_32px_rgba(28,32,36,0.35)]">
      <div className="flex items-center justify-between gap-3">
        <span className="flex flex-col">
          <b className="text-[14.5px]">{t(moved.parked ? "parkedTo" : "moved", { to: moved.label })}</b>
          {moved.parked && <span className="text-[12.5px] opacity-80">{t("parkedNote")}</span>}
        </span>
        <button type="button" className="shrink-0 text-[14px] font-semibold text-ok-bg hover:underline"
          onClick={async () => {
            const m = moved;
            setMoved(null);
            const r = await undoMoveAction(m.id, m.eventId);
            if (!r.ok) setFailed(t("undoTooLate"));
            router.refresh();
          }}>
          {t("undo")} · {left}″
        </button>
      </div>
      <label className="flex items-center gap-2 text-[13px] opacity-90">
        <input type="checkbox" checked={moved.notify} className="h-4 w-4 accent-primary"
          onChange={(e) => {
            const notify = e.target.checked;
            setMoved({ ...moved, notify });
            void moveNotifyAction(moved.id, moved.eventId, notify);
          }} />
        {t("notify")}
      </label>
    </div>
  );
}

// «Μετακίνηση» (carry mode): the lifted card floats at the top while you go to any day,
// week or month; ✕ or Esc puts it down again.
export function CarryBar({ name, sub }: { name: string; sub: string }) {
  const t = useTranslations("calendar.move");
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  useEffect(() => {
    const drop = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const q = new URLSearchParams(params.toString());
      q.delete("carry");
      router.replace(`${path}${q.size ? `?${q}` : ""}`);
    };
    window.addEventListener("keydown", drop);
    return () => window.removeEventListener("keydown", drop);
  }, [params, path, router]);
  const cancel = () => {
    const q = new URLSearchParams(params.toString());
    q.delete("carry");
    router.replace(`${path}${q.size ? `?${q}` : ""}`);
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-3 rounded-[12px] border-2 border-primary bg-surface px-3.5 py-2 shadow-[0_8px_24px_rgba(28,32,36,0.18)]">
        <span className="text-muted" aria-hidden="true">⠿</span>
        <span className="flex flex-col">
          <b className="text-[14px]">{name}</b>
          <span className="text-[12px] text-muted">{sub}</span>
        </span>
        <button type="button" onClick={cancel} aria-label={t("cancelCarry")} className="ml-2 flex h-7 w-7 items-center justify-center rounded-full bg-line-softer text-muted hover:text-ink">✕</button>
      </div>
      <span className="text-[13px] text-ink-3">{t("carryHint")}</span>
    </div>
  );
}
