"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Dropdown } from "@/components/dropdown";
import { primaryButton, secondaryButton } from "@/components/ui";
import type { AppointmentStatus } from "@/generated/prisma/client";
import { cancelAction, startVisitAction, statusAction } from "../calendar/actions";

// One-tap status buttons on the home screens (Phase 6a-4). The page re-draws itself
// through the live updates, so nothing is kept here except "busy" and an error.
export function StepButton({ id, to, room, label, kind = "primary" }: { id: string; to: AppointmentStatus; room?: string; label: string; kind?: "primary" | "secondary" | "link" }) {
  const t = useTranslations("calendar");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const cls = kind === "primary" ? `${primaryButton} min-h-10 px-3 text-[13.5px]` : kind === "secondary" ? `${secondaryButton} min-h-10 px-3 text-[13.5px]` : "text-[13px] font-semibold text-warn-ink";
  return (
    <span className="inline-flex flex-col">
      <button type="button" disabled={pending} className={cls}
        onClick={() => start(async () => {
          const r = await statusAction(id, to, room ? { room } : {});
          setError(r.error ? t(`errors.${r.error}`) : null);
        })}>
        {label}
      </button>
      {error && <span role="alert" className="mt-1 text-[12px] text-danger-ink">{error}</span>}
    </span>
  );
}

export function StartVisitButton({ id, label }: { id: string; label: string }) {
  const t = useTranslations("calendar");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col">
      <button type="button" disabled={pending} className={`${primaryButton} min-h-10 px-3 text-[13.5px]`}
        onClick={() => start(async () => {
          const r = await startVisitAction(id);
          setError(r?.error ? t(`errors.${r.error}`) : null);
        })}>
        {label}
      </button>
      {error && <span role="alert" className="mt-1 text-[12px] text-danger-ink">{error}</span>}
    </span>
  );
}

// "Έτοιμος · ειδοποίηση": pick the room the patient was taken to (the first free one is
// pre-selected); the doctor gets the banner.
export function RoomNotify({ id, rooms, suggested }: { id: string; rooms: string[]; suggested?: string }) {
  const t = useTranslations("home");
  const [room, setRoom] = useState(suggested ?? rooms[0]);
  return (
    <span className="flex flex-wrap items-start justify-end gap-1.5">
      <Dropdown label={t("room")} placeholder={null} value={room} onChange={(v) => v && setRoom(v)} options={rooms.map((r) => ({ value: r, label: r }))} className="w-[190px]" />
      <StepButton id={id} to="READY" room={room} label={t("notify")} />
    </span>
  );
}

// «Δεν ήρθε» on the home screen: the no-show path (red flag, logged) of 6a-8.
export function NoShowButton({ id, label }: { id: string; label: string }) {
  const t = useTranslations("calendar.cancel");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col">
      <button type="button" disabled={pending} className="text-[13px] font-semibold text-warn-ink"
        onClick={() => start(async () => {
          const r = await cancelAction(id, { kind: "no_show" });
          setError(r.error ? t(`errors.${r.error}`) : null);
        })}>
        {label}
      </button>
      {error && <span role="alert" className="mt-1 text-[12px] text-danger-ink">{error}</span>}
    </span>
  );
}
