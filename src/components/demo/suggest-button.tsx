"use client";

import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { primaryButton, secondaryButton, textareaClass } from "@/components/ui";
import { addSuggestionAction } from "@/app/(app)/suggestions/actions";

// Readable screen name for the address (stored with the comment, next to the address itself).
const SCREENS: [RegExp, string][] = [
  [/^\/$/, "home"],
  [/^\/patients\/new/, "patientNew"],
  [/^\/patients\/[^/]+/, "patient"],
  [/^\/patients/, "patients"],
  [/^\/calendar/, "calendar"],
  [/^\/chat/, "chat"],
  [/^\/settings/, "settings"],
  [/^\/admin/, "admin"],
  [/^\/suggestions/, "suggestions"],
];

// «💬 Πρόταση» (online demo only): a small button on every screen; the comment is saved with
// the screen, the user and the time.
export function SuggestButton() {
  const t = useTranslations("demo");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const [pending, start] = useTransition();

  const screenKey = SCREENS.find(([re]) => re.test(pathname))?.[1];
  const screen = screenKey ? t(`screens.${screenKey}` as "screens.home") : pathname;
  const send = () =>
    start(async () => {
      const r = await addSuggestionAction({ screen, path: window.location.pathname + window.location.search, text });
      if (!r.ok) return setState("error");
      setText("");
      setState("saved");
    });

  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setState("idle"); }}
        className="fixed bottom-[84px] right-3 z-[55] flex min-h-10 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 text-[13.5px] font-semibold text-ink shadow-[0_6px_18px_rgba(28,32,36,0.18)] hover:bg-surface-2 md:bottom-5 md:right-5">
        <span aria-hidden>💬</span> {t("suggest")}
      </button>
      {open && (
        <div role="dialog" aria-label={t("suggest")} className="fixed bottom-[132px] right-3 z-[75] flex w-[min(380px,calc(100vw-24px))] flex-col gap-2.5 rounded-[14px] border border-line bg-surface p-4 shadow-[0_16px_40px_rgba(28,32,36,0.28)] md:bottom-[72px] md:right-5">
          <b className="text-[15px]">{t("suggestTitle")}</b>
          <span className="text-[12.5px] text-muted">{t("screen")}: {screen}</span>
          {state === "saved" ? (
            <p role="status" className="text-sm font-semibold text-ok-ink">✓ {t("saved")}</p>
          ) : (
            <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={2000} placeholder={t("placeholder")} className={`${textareaClass} mt-0`} />
          )}
          {state === "error" && <p role="alert" className="text-[13px] text-danger-ink">{t("error")}</p>}
          <div className="flex gap-2">
            {state === "saved" ? (
              <>
                <button type="button" onClick={() => setState("idle")} className={`${secondaryButton} min-h-10`}>{t("another")}</button>
                <button type="button" onClick={() => setOpen(false)} className={`${primaryButton} min-h-10`}>{t("close")}</button>
              </>
            ) : (
              <>
                <button type="button" disabled={pending || !text.trim()} onClick={send} className={`${primaryButton} min-h-10`}>{t("send")}</button>
                <button type="button" onClick={() => setOpen(false)} className={`${secondaryButton} min-h-10`}>{t("cancel")}</button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
