"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { SearchResult } from "@/app/api/patients/search/route";
import { FlagDot } from "./patient-bits";

// The search bar on every screen (SPEC §5): results appear as you type.
export function PatientSearch({ limited }: { limited: boolean }) {
  const t = useTranslations("search");
  const tp = useTranslations("patients");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [multiCompany, setMultiCompany] = useState(false);
  // -1 = nothing chosen: Enter opens the full results list.
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);

  // "/" or Ctrl+K jumps to the search box from anywhere (unless typing elsewhere).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]");
      if ((e.key === "/" && !typing) || (e.key === "k" && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!q.trim()) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/patients/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (!res.ok) return;
        const data = await res.json();
        setResults(data.results);
        setMultiCompany(data.multiCompany);
        setActive(-1);
      } catch {
        // Typing again cancels the previous request; nothing to do.
      }
    }, 120);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);

  const go = (path: string) => {
    setOpen(false);
    setQ("");
    setResults(null);
    input.current?.blur();
    router.push(path);
  };
  const showAll = () => go(`/patients?q=${encodeURIComponent(q.trim())}`);
  const shown = q.trim() ? results : null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, (shown?.length ?? 1) - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && shown?.[active]) go(`/patients/${shown[active].id}`);
      else if (q.trim()) showAll();
    } else if (e.key === "Escape") {
      setOpen(false);
      input.current?.blur();
    }
  };

  return (
    <div className="relative w-full max-w-md">
      <input
        ref={input}
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        placeholder={limited ? t("placeholderLimited") : t("placeholder")}
        aria-label={t("label")}
        autoComplete="off"
        spellCheck={false}
        className="w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
      />
      {open && shown && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-neutral-200 bg-white text-sm shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          {shown.length === 0 ? (
            <p className="px-3 py-2 text-neutral-500">{t("none")}</p>
          ) : (
            <ul role="listbox">
              {shown.map((r, i) => (
                <li key={r.id} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => go(`/patients/${r.id}`)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/60 ${i === active ? "bg-neutral-100 dark:bg-neutral-800" : ""}`}
                  >
                    <span className="w-14 shrink-0 tabular-nums text-neutral-500">{r.number}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">{r.name}</span>
                        <FlagDot flag={r.flag} label={tp(`flag.${r.flag}`)} />
                        {r.infectious && <span title={tp("infectious")} className="text-xs font-semibold text-red-700 dark:text-red-400">⚠</span>}
                      </span>
                      <span className="block truncate text-xs text-neutral-500">
                        {[
                          r.fatherName && t("father", { name: r.fatherName }),
                          r.age !== null && tp("years", { years: r.age }),
                          r.phone,
                          multiCompany && r.company,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={showAll}
            className="block w-full border-t border-neutral-200 px-3 py-2 text-left text-xs text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            {t("showAll")}
          </button>
        </div>
      )}
    </div>
  );
}
