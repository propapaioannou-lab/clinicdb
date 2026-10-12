"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { useLive } from "./use-live";

// Re-draws the page (server data) when an appointment of this company changes anywhere.
export function LiveRefresh({ companyId }: { companyId: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useLive((e) => {
    if (e.companyId !== companyId) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), 250);
  });
  return null;
}
