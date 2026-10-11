"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchIcon } from "@/components/icons";

// The big search box on the Patients page: the list below updates as you type.
export function SearchBox({ placeholder, label }: { placeholder: string; label: string }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [pending, startTransition] = useTransition();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (q.trim()) next.set("q", q.trim());
      else next.delete("q");
      next.delete("page");
      startTransition(() => router.replace(`${path}?${next.toString()}`, { scroll: false }));
    }, 200);
    return () => clearTimeout(timer);
    // Only typing should trigger a new search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <label className="flex h-[60px] items-center gap-3 rounded-[14px] border-2 border-primary bg-surface px-[18px]">
      <SearchIcon size={22} className="shrink-0 text-primary" />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        autoFocus
        autoComplete="off"
        spellCheck={false}
        className="min-w-0 flex-1 border-0 bg-transparent text-lg text-ink outline-none"
      />
      {pending && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-primary-tint border-t-primary" />}
    </label>
  );
}
