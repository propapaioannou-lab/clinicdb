import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { secondaryButton } from "@/components/ui";
import { requireSession } from "@/lib/auth/current";
import { listSuggestions } from "@/lib/demo-suggestions";
import { loadActor } from "@/lib/users/manage";
import { DoneTick } from "./done-tick";

const SHOWS = ["open", "done", "all"] as const;

// «Προτάσεις» (online demo, Owners/Admins): the «💬 Πρόταση» comments, newest first; tick
// them done; export to Markdown.
export default async function SuggestionsPage({ searchParams }: PageProps<"/suggestions">) {
  const session = await requireSession();
  const actor = await loadActor(session.user.id);
  const q = (await searchParams).show;
  const show = SHOWS.find((s) => s === q) ?? "open";
  const rows = await listSuggestions(actor, show);
  if (!rows) notFound();
  const t = await getTranslations("demo");
  const format = await getFormatter();

  return (
    <main className="mx-auto flex w-full max-w-[900px] flex-col gap-4 px-4 py-5 md:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-semibold">{t("pageTitle")}</h1>
        <nav aria-label={t("pageTitle")} className="flex gap-[3px] rounded-[10px] bg-line-softer p-[3px]">
          {SHOWS.map((s) => (
            <Link key={s} href={`/suggestions?show=${s}`} aria-current={s === show ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 text-[13px] ${s === show ? "bg-surface font-semibold text-primary shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "font-medium text-muted hover:text-ink"}`}>{t(`show.${s}`)}</Link>
          ))}
        </nav>
        <a href={`/api/suggestions/export?show=${show}`} className={`${secondaryButton} ml-auto min-h-10`}>{t("export")}</a>
      </div>
      <p className="text-[13px] text-muted">{t("pageIntro")}</p>
      {rows.length ? (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id} className={`flex items-start gap-3 rounded-card border border-line bg-surface px-4 py-3 ${r.doneAt ? "opacity-60" : ""}`}>
              <DoneTick id={r.id} done={!!r.doneAt} label={t("done")} />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className={`whitespace-pre-wrap text-[15px] ${r.doneAt ? "line-through" : ""}`}>{r.text}</span>
                <span className="text-[12.5px] text-muted">
                  <b className="text-ink-3">{r.screen}</b> · {r.userName} · {format.dateTime(new Date(r.at), { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/Athens" })}
                  {" · "}<Link href={r.path} className="underline">{r.path}</Link>
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="text-muted">{t("empty")}</p>}
    </main>
  );
}
