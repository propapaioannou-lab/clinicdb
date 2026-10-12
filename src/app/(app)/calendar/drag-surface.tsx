"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { minuteAt, yOf, type Scale } from "@/lib/calendar/bands";
import { zoneOf, type Span } from "@/lib/calendar/hours";
import { moveAction } from "./actions";

// Moving appointments (6a-7, DESIGN 6g panel 3) on the day and week grids:
//  · drag a card to another time / day / column; drag its bottom edge to change the length;
//  · «Μετακίνηση» (carry mode): the card is lifted, a ghost of its length follows the mouse
//    in any day/week, a click puts it there.
// While moving, a ghost shows where it would go: green = free, amber = «εκτός ωραρίου
// +30′», blue = taken or too short — dropping there PARKS it (it floats over the other
// appointment until room is made or its time changes), red = closed / past (dropping
// there does nothing). The grid tells this
// component what is where through data attributes:
//   [data-col]  = { date, resourceId, weekday, normal: Span[], flex: Span[] } (one column)
//   [data-appt] = { id, date, resourceId, start, end, active, movable, label } (one card)
//   [data-resize] inside a card = its bottom edge.

export type ColInfo = { date: string; resourceId: string; weekday: number; normal: Span[]; flex: Span[] };
export type ApptInfo = { id: string; date: string; resourceId: string; start: number; end: number; active: boolean; movable: boolean; label: string };
export type Carry = { id: string; minutes: number; label: string };
export type MovedEvent = { id: string; eventId: string; label: string; parked?: boolean };

const SNAP = 5;
const snap = (m: number) => Math.round(m / SNAP) * SNAP;
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const dayLabel = new Intl.DateTimeFormat("el-GR", { weekday: "short", day: "numeric", month: "numeric", timeZone: "UTC" });
const slotLabel = (date: string, start: number) => `${dayLabel.format(new Date(`${date}T12:00:00Z`))} · ${hhmm(start)}`;
const parse = <T,>(el: Element | null, attr: string): T | null => {
  const v = el?.getAttribute(attr);
  return v ? (JSON.parse(v) as T) : null;
};
const athensNow = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { iso: `${p.year}-${p.month}-${p.day}`, minute: Number(p.hour) * 60 + Number(p.minute) };
};

type Ghost = { left: number; top: number; width: number; height: number; tone: "ok" | "flex" | "park" | "bad"; text: string; flex?: boolean };
type Target = { col: ColInfo; start: number; end: number; tone: Ghost["tone"]; text: string; flex?: boolean };
type Drag = { mode: "move" | "resize"; appt: ApptInfo; el: HTMLElement; grab: number; x: number; y: number; started: boolean; touchReady: boolean };

export function DragSurface({ scale, carry, className, style, children }: { scale: Scale; carry?: Carry | null; className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  const t = useTranslations("calendar.move");
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const target = useRef<Target | null>(null);
  const swallowClick = useRef(false);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [busy, setBusy] = useState(false);
  const inBrowser = useSyncExternalStore(() => () => {}, () => true, () => false);

  // Where would [start, end) in this column go? (the server checks again on saving)
  const judge = (col: ColInfo, start: number, end: number, selfId: string, label: string): Target => {
    const now = athensNow();
    const clash = [...(box.current?.querySelectorAll("[data-appt]") ?? [])]
      .map((el) => parse<ApptInfo>(el, "data-appt")!)
      .find((a) => a.active && a.id !== selfId && a.date === col.date && a.resourceId === col.resourceId && a.start < end && a.end > start);
    const zone = zoneOf({ normal: col.normal, flex: col.flex, surgery: [] }, col.weekday, start, end);
    const at = slotLabel(col.date, start);
    if (col.date < now.iso || (col.date === now.iso && start < now.minute)) return { col, start, end, tone: "bad", text: `${hhmm(start)} × ${t("past")}` };
    if (zone === "off" || zone === "weekend") return { col, start, end, tone: "bad", text: `${hhmm(start)} × ${t("closed")}` };
    if (clash) return { col, start, end, tone: "park", flex: zone === "flex", text: `⤓ ${at} · ${t("park", { name: clash.label })}` };
    if (zone === "flex") return { col, start, end, tone: "flex", text: `${at} · ${t("flex")}` };
    return { col, start, end, tone: "ok", text: `${at} ✓ ${label}` };
  };

  // The column under the pointer (resizing stays in the card's own column).
  const columnAt = (x: number, y: number, only?: ApptInfo) => {
    for (const el of box.current?.querySelectorAll<HTMLElement>("[data-col]") ?? []) {
      const c = parse<ColInfo>(el, "data-col")!;
      const r = el.getBoundingClientRect();
      if (only ? c.date === only.date && c.resourceId === only.resourceId : x >= r.left && x < r.right && y >= r.top && y < r.bottom) return { c, r };
    }
    return null;
  };

  const show = (tg: Target | null, rect?: DOMRect) => {
    target.current = tg;
    if (!tg || !rect) return setGhost(null);
    const top = rect.top + yOf(scale, tg.start);
    setGhost({ left: rect.left + 2, width: rect.width - 4, top, height: Math.max(14, yOf(scale, tg.end) - yOf(scale, tg.start)), tone: tg.tone, text: tg.text });
  };

  const commit = async (id: string, tg: Target, minutes: number) => {
    show(null);
    if (tg.tone === "bad") {
      window.dispatchEvent(new CustomEvent("clinic:move-failed", { detail: tg.text }));
      return;
    }
    setBusy(true);
    const r = await moveAction(id, { date: tg.col.date, time: hhmm(tg.start), minutes, resourceId: tg.col.resourceId, flex: tg.tone === "flex" || tg.flex, override: tg.tone === "park" });
    setBusy(false);
    if (r.ok && r.eventId) {
      window.dispatchEvent(new CustomEvent<MovedEvent>("clinic:moved", { detail: { id, eventId: r.eventId, label: slotLabel(tg.col.date, tg.start), parked: tg.tone === "park" } }));
      if (carry) {
        const q = new URLSearchParams(params.toString());
        q.delete("carry");
        router.replace(`${path}${q.size ? `?${q}` : ""}`);
      }
      router.refresh();
    } else window.dispatchEvent(new CustomEvent("clinic:move-failed", { detail: r.problems?.[0] ?? t("refused") }));
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      // Carry mode: the ghost follows the mouse over the grid.
      if (carry && !drag.current) {
        const hit = columnAt(e.clientX, e.clientY);
        if (!hit) return show(null);
        const start = snap(minuteAt(scale, e.clientY - hit.r.top));
        return show(judge(hit.c, start, start + carry.minutes, carry.id, carry.label), hit.r);
      }
      const d = drag.current;
      if (!d) return;
      if (!d.started) {
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6 || !d.touchReady) return;
        d.started = true;
        d.el.style.opacity = "0.35";
      }
      e.preventDefault();
      const hit = columnAt(e.clientX, e.clientY, d.mode === "resize" ? d.appt : undefined);
      if (!hit) return show(null);
      const at = minuteAt(scale, e.clientY - hit.r.top);
      if (d.mode === "resize") {
        const end = Math.max(d.appt.start + SNAP, snap(at));
        return show(judge(hit.c, d.appt.start, end, d.appt.id, d.appt.label), hit.r);
      }
      const start = snap(at - d.grab);
      show(judge(hit.c, start, start + d.appt.end - d.appt.start, d.appt.id, d.appt.label), hit.r);
    };
    const up = () => {
      const d = drag.current;
      drag.current = null;
      if (!d) return;
      d.el.style.opacity = "";
      if (!d.started) return;
      swallowClick.current = true;
      const tg = target.current;
      show(null);
      if (tg) void commit(d.appt.id, tg, tg.end - tg.start);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (drag.current) {
        drag.current.el.style.opacity = "";
        drag.current = null;
        show(null);
      }
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("keydown", key);
    };
  });

  const down = (e: React.PointerEvent) => {
    if (carry || busy || e.button !== 0) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-appt]");
    const appt = parse<ApptInfo>(el, "data-appt");
    if (!el || !appt?.movable) return;
    const resize = !!(e.target as HTMLElement).closest("[data-resize]");
    const hit = columnAt(e.clientX, e.clientY, appt);
    const grab = hit ? minuteAt(scale, e.clientY - hit.r.top) - appt.start : 0;
    const d: Drag = { mode: resize ? "resize" : "move", appt, el, grab, x: e.clientX, y: e.clientY, started: false, touchReady: e.pointerType !== "touch" };
    drag.current = d;
    // On a touch screen: hold for a moment, then drag (a quick swipe still scrolls).
    if (e.pointerType === "touch") setTimeout(() => drag.current === d && (d.touchReady = true), 300);
  };

  // After a drag, the click that follows must not open the card; in carry mode a click
  // on the grid puts the carried appointment there.
  const click = (e: React.MouseEvent) => {
    if (swallowClick.current) {
      swallowClick.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (!carry) return;
    e.preventDefault();
    e.stopPropagation();
    const tg = target.current;
    if (tg) void commit(carry.id, tg, carry.minutes);
  };

  const tone = ghost?.tone === "ok" ? "border-ok bg-ok-bg/90 text-ok-ink" : ghost?.tone === "flex" ? "border-warn bg-warn-bg/90 text-warn-ink" : ghost?.tone === "park" ? "border-cal-blue bg-cal-blue-bg/95 text-cal-blue" : "border-danger bg-danger-bg/90 text-danger-ink";
  return (
    <div ref={box} className={`${className ?? ""} ${carry ? "cursor-copy" : ""}`} style={style} onPointerDown={down} onClickCapture={click} onPointerLeave={() => carry && !drag.current && show(null)} aria-busy={busy}>
      {children}
      {inBrowser && ghost && createPortal(
        <div aria-hidden="true" className={`pointer-events-none fixed z-[60] overflow-hidden rounded-[7px] border-2 border-dashed px-2 py-0.5 text-[12px] font-semibold shadow-[0_6px_18px_rgba(28,32,36,0.18)] ${tone}`}
          style={{ left: ghost.left, top: ghost.top, width: ghost.width, height: ghost.height }}>
          {ghost.text}
        </div>,
        document.body,
      )}
    </div>
  );
}
