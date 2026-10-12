"use client";

import { useEffect, useRef } from "react";

export type LiveAppointment = {
  type: "appointment";
  companyId: string;
  appointmentId: string;
  action: string;
  status: string;
  room: string | null;
  resourceId: string;
  patientId: string | null;
  patientShort: string | null;
  byName: string | null;
  at: string;
};

// One EventSource per tab, shared by every component that listens.
const listeners = new Set<(e: LiveAppointment) => void>();
let source: EventSource | null = null;
function ensure() {
  if (source || typeof window === "undefined") return;
  source = new EventSource("/api/live");
  source.addEventListener("appointment", (msg) => {
    try {
      const e = JSON.parse((msg as MessageEvent).data) as LiveAppointment;
      for (const l of listeners) l(e);
    } catch {}
  });
}

export function useLive(onEvent: (e: LiveAppointment) => void) {
  const ref = useRef(onEvent);
  useEffect(() => {
    ref.current = onEvent;
  });
  useEffect(() => {
    ensure();
    const l = (e: LiveAppointment) => ref.current(e);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
}
