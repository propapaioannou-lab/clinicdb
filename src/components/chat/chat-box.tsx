"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { inputClass } from "@/components/ui";
import { useLiveChat } from "@/components/live/use-live";
import type { ChatLine } from "@/lib/chat/chat";
import { sendChatAction } from "@/app/(app)/chat/actions";

const time = new Intl.DateTimeFormat("el-GR", { timeZone: "Europe/Athens", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const day = new Intl.DateTimeFormat("el-GR", { timeZone: "Europe/Athens", day: "numeric", month: "numeric" });
const athensDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" }).format(new Date(iso));

// Internal staff chat (DESIGN 1a/1b/1e, 6a-10): live messages, one-tap presets, a text
// field. New messages arrive within a second on every open screen of the practice.
export function ChatBox({ companyId, meId, initial, presets, title, tall = false }: { companyId: string; meId: string; initial: ChatLine[]; presets: string[]; title: string; tall?: boolean }) {
  const t = useTranslations("chat");
  const [lines, setLines] = useState(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const log = useRef<HTMLDivElement>(null);

  useLiveChat((e) => {
    if (e.companyId !== companyId) return;
    setLines((xs) => (xs.some((x) => x.id === e.message.id) ? xs : [...xs, e.message].slice(-200)));
  });
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "smooth" });
  }, [lines.length]);

  const send = (value: string) =>
    start(async () => {
      const r = await sendChatAction(value);
      if (!r.ok) return setError(t(`errors.${r.error}`));
      setError(null);
      setText("");
      setLines((xs) => (xs.some((x) => x.id === r.message.id) ? xs : [...xs, r.message]));
    });
  const today = athensDay(new Date().toISOString());
  const others = [...new Set(lines.filter((l) => l.senderId !== meId).map((l) => l.senderName))].slice(0, 3);

  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-card border border-line bg-surface px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-semibold">{title}</h2>
        {others.length > 0 && <span className="flex items-center gap-1.5 text-[12.5px] text-muted"><span className="h-2 w-2 rounded-full bg-ok" />{others.join(", ")}</span>}
      </div>
      <div ref={log} role="log" aria-live="polite" aria-label={t("messages")} className={`flex flex-col gap-2 overflow-y-auto pr-1 ${tall ? "max-h-[calc(100vh-330px)] min-h-[300px]" : "max-h-[260px]"}`}>
        {lines.length === 0 && <p className="text-sm text-muted">{t("empty")}</p>}
        {lines.map((l) => {
          const mine = l.senderId === meId;
          return (
            <div key={l.id} className={`flex max-w-[85%] flex-col gap-0.5 ${mine ? "items-end self-end" : "items-start self-start"}`}>
              <span className={`max-w-full rounded-[14px] px-3 py-2 text-[14px] leading-snug [overflow-wrap:anywhere] ${mine ? "rounded-br-[4px] bg-primary text-white" : "rounded-bl-[4px] bg-line-softer text-ink"}`}>{l.text}</span>
              <span className="text-[11.5px] text-muted">{mine ? t("you") : l.senderName} · {athensDay(l.at) === today ? "" : `${day.format(new Date(l.at))} `}{time.format(new Date(l.at))}</span>
            </div>
          );
        })}
      </div>
      {presets.length > 0 && (
        <div role="group" aria-label={t("presets")} className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button key={p} type="button" disabled={pending} onClick={() => send(p)}
              className="min-h-9 rounded-full border border-line-strong px-3 text-[13px] text-ink-2 hover:border-primary hover:text-primary">{p}</button>
          ))}
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) send(text); }} className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`chat-${companyId}`}>{t("message")}</label>
        <input id={`chat-${companyId}`} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder={t("placeholder")} className={`${inputClass} mt-0 flex-1`} />
        <button type="submit" disabled={pending || !text.trim()} aria-label={t("send")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-primary text-white disabled:opacity-40">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l16-8-6 16-2-7z" /></svg>
        </button>
      </form>
      {error && <p role="alert" className="text-[13px] text-danger-ink">{error}</p>}
    </section>
  );
}
