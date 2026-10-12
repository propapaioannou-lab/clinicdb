"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { primaryButton, secondaryButton } from "@/components/ui";
import type { AppointmentStatus } from "@/generated/prisma/client";
import { startVisitAction, statusAction } from "../calendar/actions";

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
