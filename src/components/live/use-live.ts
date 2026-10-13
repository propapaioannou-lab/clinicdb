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

export type LiveChat = { type: "chat"; companyId: string; message: { id: string; senderId: string; senderName: string; senderRole: string; text: string; at: string } };

// One EventSource per tab, shared by every component that listens.
const listeners = new Set<(e: LiveAppointment) => void>();
const chatListeners = new Set<(e: LiveChat) => void>();
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
  source.addEventListener("chat", (msg) => {
    try {
      const e = JSON.parse((msg as MessageEvent).data) as LiveChat;
      for (const l of chatListeners) l(e);
    } catch {}
  });
}

// New staff-chat messages (6a-10).
export function useLiveChat(onMessage: (e: LiveChat) => void) {
  const ref = useRef(onMessage);
  useEffect(() => {
    ref.current = onMessage;
  });
  useEffect(() => {
    ensure();
    const l = (e: LiveChat) => ref.current(e);
    chatListeners.add(l);
    return () => {
      chatListeners.delete(l);
    };
  }, []);
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
