"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { SearchResult } from "@/app/api/patients/search/route";
import { SearchIcon } from "./icons";
import { FlagDot, RiskBadge } from "./patient-bits";

// The search bar on every screen (SPEC §5): results appear as you type.
export function PatientSearch({ limited }: { limited: boolean }) {
  const t = useTranslations("search");
  const tp = useTranslations("patients");
  const th = useTranslations("history");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  // -1 = nothing chosen: Enter opens the full results list.
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);

  // "/" or Ctrl+K jumps to the search box from anywhere (unless typing elsewhere).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]");
      if ((e.key === "/" && !typing) || (e.key === "k" && (e.ctrlKey || e.metaKey))) {
        // Hidden (the calendar on a wide screen has its own search window): leave it to that.
        if (!input.current?.offsetParent) return;
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
    <div className="relative min-w-0 flex-1">
      <label className="flex h-[46px] items-center gap-2.5 rounded-[11px] border border-line-strong bg-surface px-3.5 focus-within:border-primary">
        <SearchIcon className="shrink-0 text-muted" />
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
          className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ink outline-none"
        />
        <kbd className="hidden rounded-md border border-line-strong px-1.5 py-0.5 font-sans text-xs text-muted sm:inline">Ctrl K</kbd>
      </label>
      {open && shown && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1.5 overflow-hidden rounded-[14px] border border-line bg-surface text-sm shadow-[0_8px_24px_rgba(28,32,36,0.12)]">
          {shown.length === 0 ? (
            <p className="px-4 py-3 text-muted">{t("none")}</p>
          ) : (
            <ul role="listbox">
              {shown.map((r, i) => (
                <li key={r.id} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => go(`/patients/${r.id}`)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2 ${i === active ? "bg-primary-tint" : ""}`}
                  >
                    <span className="w-[72px] shrink-0 tabular-nums text-muted">{r.code}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">{r.name}</span>
                        <FlagDot flag={r.flag} label={tp(`flag.${r.flag}`)} />
                        {r.infectious && <span title={tp("infectious")} className="text-xs font-semibold text-danger">⚠</span>}
                        {r.highRisk && <RiskBadge label={th("risk.short")} compact />}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {[
                          r.fatherName && t("father", { name: r.fatherName }),
                          r.age !== null && tp("years", { years: r.age }),
                          r.phone,
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
            className="block w-full border-t border-line-soft px-4 py-2.5 text-left text-xs font-medium text-primary hover:bg-surface-2"
          >
            {t("showAll")}
          </button>
        </div>
      )}
    </div>
  );
}
