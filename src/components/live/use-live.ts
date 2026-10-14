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

// Patients waiting on the calendar for a time changed (calendar v3).
export type LiveBubble = { type: "bubble"; companyId: string; action: string; bubbleId: string; at: string };

export type LiveChat = { type: "chat"; companyId: string; message: { id: string; senderId: string; senderName: string; senderRole: string; text: string; at: string } };

// One EventSource per tab, shared by every component that listens.
const listeners = new Set<(e: LiveAppointment) => void>();
const chatListeners = new Set<(e: LiveChat) => void>();
const bubbleListeners = new Set<(e: LiveBubble) => void>();
let source: EventSource | null = null;
function open() {
  source = new EventSource("/api/live");
  source.addEventListener("appointment", (msg) => {
    try {
      const e = JSON.parse((msg as MessageEvent).data) as LiveAppointment;
      for (const l of listeners) l(e);
    } catch {}
  });
  source.addEventListener("bubble", (msg) => {
    try {
      const e = JSON.parse((msg as MessageEvent).data) as LiveBubble;
      for (const l of bubbleListeners) l(e);
    } catch {}
  });
  source.addEventListener("chat", (msg) => {
    try {
      const e = JSON.parse((msg as MessageEvent).data) as LiveChat;
      for (const l of chatListeners) l(e);
    } catch {}
  });
}

// The online demo runs on free hosting whose database sleeps when nobody works: a tab left
// open without anyone touching it for 20′ closes its live line, and opens it again (with a
// refresh, so nothing is missed) at the next mouse move or key press.
const IDLE_MS = 20 * 60_000;
let idleWatch = false;
function watchIdle() {
  if (idleWatch || document.documentElement.dataset.demo !== "1") return;
  idleWatch = true;
  let last = Date.now();
  let asleep = false;
  const wake = () => {
    last = Date.now();
    if (!asleep) return;
    asleep = false;
    open();
    window.dispatchEvent(new Event("clinic:live-wake"));
  };
  for (const ev of ["pointerdown", "pointermove", "keydown", "focus", "touchstart"]) window.addEventListener(ev, wake, { passive: true });
  setInterval(() => {
    if (asleep || Date.now() - last < IDLE_MS) return;
    asleep = true;
    source?.close();
    source = null;
  }, 60_000);
}

function ensure() {
  if (typeof window === "undefined") return;
  watchIdle();
  if (!source) open();
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

export function useLiveBubble(onEvent: (e: LiveBubble) => void) {
  const ref = useRef(onEvent);
  useEffect(() => {
    ref.current = onEvent;
  });
  useEffect(() => {
    ensure();
    const l = (e: LiveBubble) => ref.current(e);
    bubbleListeners.add(l);
    return () => {
      bubbleListeners.delete(l);
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
