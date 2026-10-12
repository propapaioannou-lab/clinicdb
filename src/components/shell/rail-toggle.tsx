"use client";

import { useState } from "react";

// «»» / «««: the left menu as a 68 px icon rail or full width (DESIGN 6a–6g). Remembered on
// this device (a cookie, so the page is drawn right the first time). Under 1280 px the
// menu is always a rail and this button is hidden.
export function RailToggle({ initial, labels }: { initial: boolean; labels: { open: string; close: string } }) {
  const [rail, setRail] = useState(initial);
  const flip = () => {
    const next = !rail;
    setRail(next);
    document.cookie = `clinic_rail=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
    document.getElementById("side-menu")?.setAttribute("data-rail", String(next));
  };
  return (
    <button type="button" onClick={flip} aria-label={rail ? labels.open : labels.close} title={rail ? labels.open : labels.close}
      className="rail-toggle flex h-8 w-8 items-center justify-center self-end rounded-[8px] text-[15px] font-semibold text-muted hover:bg-line-softer hover:text-ink">
      {rail ? "»" : "«"}
    </button>
  );
}
