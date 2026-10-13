"use client";

import { useTransition } from "react";
import { setSuggestionDoneAction } from "./actions";

export function DoneTick({ id, done, label }: { id: string; done: boolean; label: string }) {
  const [pending, start] = useTransition();
  return (
    <input type="checkbox" aria-label={label} title={label} checked={done} disabled={pending}
      onChange={(e) => { const v = e.target.checked; start(async () => { await setSuggestionDoneAction(id, v); }); }}
      className="mt-1 h-5 w-5 shrink-0 accent-primary" />
  );
}
