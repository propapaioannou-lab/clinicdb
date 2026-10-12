import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { companies, ctx, makeActor, makePatient } from "../../../test/factories";
import { saveCalendarConfig } from "@/lib/settings/calendar";
import { createAppointment, moveAppointment } from "./appointments";
import { buildScale, ticks, yOf } from "./bands";
import { calendarConfigOf } from "./config";
import { calendarDay } from "./day";
import { surgeryLoad } from "./capacity";
import { cleanConfig, DEFAULT_CONFIG, DEFAULT_HOURS, dayRules, zoneOf } from "./hours";
import { confirmations, nextWorkingDay } from "./strip";

// Calendar v2 (SPEC §4c, 12 Oct 2026): office Mon/Tue/Thu 16:30–20:00, flex zones ±30′,
// surgery window Mon–Fri 07:30–14:00, weekends closed, two-band layout.

describe("hours rules", () => {
  const mon = dayRules(DEFAULT_HOURS, DEFAULT_CONFIG, 1, { surgeryWindow: true });
  it("office hours, flex zones and the surgery window of a day", () => {
    expect(mon.normal).toEqual([{ from: 990, to: 1200 }]);
    expect(mon.flex).toEqual([{ from: 960, to: 990 }, { from: 1200, to: 1230 }]);
    expect(mon.surgery).toEqual([{ from: 450, to: 840 }]);
    expect(dayRules(DEFAULT_HOURS, DEFAULT_CONFIG, 3).normal).toEqual([]); // Wednesday: no office
  });
  it("where a booking falls: normal, flex, off-hours, weekend", () => {
    expect(zoneOf(mon, 1, 990, 1020)).toBe("normal");
    expect(zoneOf(mon, 1, 970, 1000)).toBe("flex"); // 16:10–16:40
    expect(zoneOf(mon, 1, 1195, 1215)).toBe("flex"); // 19:55–20:15
    expect(zoneOf(mon, 1, 1220, 1240)).toBe("off"); // runs past 20:30
    expect(zoneOf(mon, 1, 600, 630)).toBe("off"); // morning: surgery time, not office
    expect(zoneOf(mon, 1, 600, 720, { surgery: true })).toBe("normal"); // a surgery fits the window
    expect(zoneOf(mon, 1, 780, 900, { surgery: true })).toBe("off"); // ends after 14:00
    const sat = dayRules(DEFAULT_HOURS, DEFAULT_CONFIG, 6);
    expect(zoneOf(sat, 6, 600, 630)).toBe("weekend");
  });
  it("flex zones never cover office hours; settings are cleaned", () => {
    const two = dayRules([{ day: 1, from: "09:00", to: "14:00" }, { day: 1, from: "14:20", to: "18:00" }], DEFAULT_CONFIG, 1);
    expect(two.flex).toEqual([{ from: 510, to: 540 }, { from: 840, to: 860 }, { from: 1080, to: 1110 }]);
    expect(cleanConfig(null)).toEqual(DEFAULT_CONFIG);
    expect(cleanConfig(null, "spa").surgery).toEqual([]);
    expect(cleanConfig({ surgery: "x", flexBefore: 500, flexAfter: 15 })).toEqual({ ...DEFAULT_CONFIG, flexAfter: 15 });
  });
});

describe("two-band scale", () => {
  const office = [{ from: 960, to: 1230 }];
  const surgery = [{ from: 450, to: 840 }];
  it("surgery band compact, office band detailed, 14:30–16:00 folded", () => {
    const s = buildScale({ surgery, office, items: [] }, "day");
    // The surgery band starts on the full hour (07:00), as in the mockups.
    expect(s.bands.map((b) => [b.kind, b.from, b.to, b.px])).toEqual([["surgery", 420, 870, 52], ["office", 960, 1230, 144]]);
    expect(s.folds).toEqual([{ from: 870, to: 960, top: 390, height: 26 }]);
    expect(s.height).toBe(390 + 26 + 648);
    expect(yOf(s, 420)).toBe(0);
    expect(yOf(s, 960)).toBe(416); // office starts right after the fold
    expect(yOf(s, 990) - yOf(s, 980)).toBe(24); // 10′ = 24 px: readable
    expect(ticks(s).filter((t) => t.min >= 960).map((t) => t.min).slice(0, 3)).toEqual([960, 990, 1020]); // half hours in the office band
  });
  it("widens a band for anything booked outside it; week is smaller", () => {
    const s = buildScale({ surgery, office, items: [{ from: 880, to: 910 }, { from: 1250, to: 1270 }] }, "week");
    expect(s.bands.map((b) => [b.from, b.to])).toEqual([[420, 930], [960, 1290]]);
    expect(s.bands.map((b) => b.px)).toEqual([40, 112]);
    const spa = buildScale({ surgery: [], office: [{ from: 540, to: 1260 }], items: [] }, "day");
    expect(spa.bands).toHaveLength(1);
    expect(spa.bands[0].px).toBe(96); // a long office day is drawn less tall
  });
});

describe("surgery time of a day (week and month bars)", () => {
  const w = [{ from: 450, to: 840 }]; // 07:30–14:00 = 6 h 30′
  const at = (h: number, m: number, minutes: number) => ({ from: h * 60 + m, to: h * 60 + m + minutes });
  it("as in the mockup week: full, closes the day, left, only ≤, over-run", () => {
    expect(surgeryLoad([at(7, 30, 180), at(11, 0, 120)], w)).toMatchObject({ used: 330, state: "full" });
    expect(surgeryLoad([at(7, 30, 330)], w)).toMatchObject({ used: 330, state: "closes", remaining: 0 });
    expect(surgeryLoad([at(7, 30, 120), at(10, 0, 120)], w)).toMatchObject({ used: 270, state: "left", remaining: 90 });
    expect(surgeryLoad([at(7, 30, 270)], w)).toMatchObject({ used: 270, state: "short", remaining: 90 });
    expect(surgeryLoad([at(7, 30, 270), at(12, 30, 120)], w)).toMatchObject({ used: 420, state: "over" });
    expect(surgeryLoad([], w)).toMatchObject({ used: 0, state: "free", remaining: 390 });
    expect(surgeryLoad([at(7, 30, 60), at(9, 0, 60), at(10, 30, 60)], w)).toMatchObject({ ops: 3, state: "full" });
    expect(surgeryLoad([], [])).toBeNull();
  });
});

describe("booking with the v2 hours", () => {
  let c: { surgery: string; spa: string };
  let doctor: string;
  let type: string;
  let surgery: string;
  const tag = () => Math.random().toString(36).slice(2, 7);
  beforeAll(async () => {
    c = await companies();
    doctor = (await db.resource.create({ data: { companyId: c.surgery, kind: "DOCTOR", label: `Δρ v2 ${tag()}` } })).id; // default hours
    type = (await db.appointmentType.create({ data: { companyId: c.surgery, labelEl: `Επαν ${tag()}`, labelEn: "F", defaultMinutes: 10 } })).id;
    surgery = (await db.appointmentType.create({ data: { companyId: c.surgery, labelEl: `Χειρ ${tag()}`, labelEn: "S", defaultMinutes: 120, layer: "SURGERY" } })).id;
  });

  it("flex zone: one extra click; off-hours and weekend: a reason, kept in the log", async () => {
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const p = await makePatient(c.surgery, { surname: `Ευελιξία ${tag()}` });
    const book = (date: string, time: string, extra: Record<string, unknown> = {}) => createAppointment(sec, { patientId: p.id, typeId: type, resourceId: doctor, date, time, ...extra }, ctx);
    // Monday 2030-03-18, 16:10: flex.
    expect(await book("2030-03-18", "16:10")).toMatchObject({ ok: false, error: "clash", problems: [{ kind: "flex" }] });
    const flex = await book("2030-03-18", "16:10", { flex: true });
    expect(flex.ok).toBe(true);
    // Wednesday afternoon: no office → off-hours, needs a reason.
    expect(await book("2030-03-20", "17:00", { override: true })).toMatchObject({ ok: false, error: "reason_needed" });
    const off = await book("2030-03-20", "17:00", { override: true, overrideReason: "Επείγον μετεγχειρητικό" });
    if (!off.ok) throw new Error(off.error);
    expect((await db.appointmentEvent.findFirstOrThrow({ where: { appointmentId: off.id } })).details).toMatchObject({ override: ["outside_hours"], overrideReason: "Επείγον μετεγχειρητικό" });
    expect(await db.auditLog.count({ where: { action: "appointment.created", details: { path: ["overrideReason"], equals: "Επείγον μετεγχειρητικό" } } })).toBe(1);
    // Saturday.
    expect(await book("2030-03-23", "11:00")).toMatchObject({ ok: false, problems: [{ kind: "weekend" }] });
    // Moving into the flex zone takes the same extra click.
    const r = await book("2030-03-19", "17:00");
    if (!r.ok) throw new Error(r.error);
    expect(await moveAppointment(sec, r.id, { date: "2030-03-19", time: "20:10" }, ctx)).toMatchObject({ ok: false, error: "clash" });
    expect(await moveAppointment(sec, r.id, { date: "2030-03-19", time: "20:10", flex: true }, ctx)).toMatchObject({ ok: true });
  });

  it("surgeries go in the surgery window; after 14:00 is an override", async () => {
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const ok = await createAppointment(sec, { typeId: surgery, resourceId: doctor, date: "2030-03-21", time: "08:00" }, ctx);
    expect(ok.ok).toBe(true);
    expect(await createAppointment(sec, { typeId: surgery, resourceId: doctor, date: "2030-03-21", time: "13:00" }, ctx)).toMatchObject({ ok: false, problems: [{ kind: "outside_hours" }] });
  });

  it("the day carries the two bands, flex zones and free flex time", async () => {
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const day = (await calendarDay(sec, c.surgery, "2030-03-26"))!;
    const col = day.columns.find((x) => x.id === doctor)!;
    expect(col.hours).toEqual([{ from: 990, to: 1200 }]);
    expect(col.surgery).toEqual([{ from: 450, to: 840 }]);
    expect(col.flexGaps).toEqual([{ start: 960, end: 990 }, { start: 1200, end: 1230 }]);
    expect(col.freeMinutes).toBe(210); // normal hours only
    expect(day.scale.bands.map((b) => b.kind)).toEqual(["surgery", "office"]);
  });

  it("Settings → Ωράριο: managers only, cleaned, logged with old and new values", async () => {
    // Its own company, so other tests running at the same time keep the defaults.
    const co = (await db.company.create({ data: { code: `t-${tag()}`, name: "Test" } })).id;
    const owner = await makeActor("OWNER", [co], "SURGEON");
    const sec = await makeActor("USER", [co], "SECRETARY");
    expect(await saveCalendarConfig(sec, co, { surgery: [], flexBefore: 0, flexAfter: 0 }, ctx)).toEqual({ ok: false, error: "forbidden" });
    expect(await saveCalendarConfig(owner, co, { surgery: [{ day: 1, from: "08:00", to: "07:00" }], flexBefore: 30, flexAfter: 30 }, ctx)).toEqual({ ok: false, error: "invalid_value" });
    const surgeryHours = [{ day: 2, from: "08:00", to: "15:00" }];
    expect(await saveCalendarConfig(owner, co, { surgery: surgeryHours, flexBefore: "15", flexAfter: 0 }, ctx)).toEqual({ ok: true });
    expect(await calendarConfigOf(co)).toEqual({ surgery: surgeryHours, flexBefore: 15, flexAfter: 0 });
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "settings.calendarHours.updated", companyId: co }, orderBy: { at: "desc" } });
    expect(log.details).toMatchObject({ after: { flexBefore: 15 }, before: { flexBefore: 30 } });
  });

  it("tomorrow's confirmations: next working day, pending ones listed", async () => {
    expect(nextWorkingDay("2030-03-15")).toBe("2030-03-18"); // Friday → Monday
    const sec = await makeActor("USER", [c.surgery], "SECRETARY");
    const p = await makePatient(c.surgery, { surname: `Αύριο ${tag()}` });
    await createAppointment(sec, { patientId: p.id, typeId: type, resourceId: doctor, date: "2030-04-01", time: "17:00" }, ctx);
    const conf = (await confirmations(sec, c.surgery, "2030-03-29"))!;
    expect(conf.date).toBe("2030-04-01");
    expect(conf.pending.some((x) => x.patientId === p.id && x.time === "17:00")).toBe(true);
    expect(await confirmations(await makeActor("GUEST", [c.surgery]), c.surgery, "2030-03-29")).toBeNull();
  });
});
