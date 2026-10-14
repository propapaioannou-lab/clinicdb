"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useLive, useLiveBubble } from "./use-live";

// Re-draws the page (server data) when an appointment of this company changes anywhere,
// or a patient starts / stops waiting for a time.
export function LiveRefresh({ companyId }: { companyId: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const changed = (e: { companyId: string }) => {
    if (e.companyId !== companyId) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), 250);
  };
  useLive(changed);
  useLiveBubble(changed); // patients waiting for a time (calendar v3)
  // Demo: the live line reopened after a quiet spell — fetch what changed meanwhile.
  useEffect(() => {
    const wake = () => router.refresh();
    window.addEventListener("clinic:live-wake", wake);
    return () => window.removeEventListener("clinic:live-wake", wake);
  }, [router]);
  return null;
}
