"use client";

import { useEffect, useId, useRef, useState } from "react";

export type DropdownOption<T extends string | number> = { value: T; label: string };

// Our own drop-down (decided 11 Oct 2026): always opens downwards, rounded, in the app's
// style (the browser's own list may open upwards and looks different on every system).
// Keyboard: ↑ ↓ to move, Enter to choose, Esc to close.
export function Dropdown<T extends string | number>({
  value,
  options,
  onChange,
  label,
  placeholder = "—",
  className = "",
}: {
  value: T | undefined;
  options: DropdownOption<T>[];
  onChange: (v: T | undefined) => void;
  label: string;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  const current = options.find((o) => o.value === value);
  // "—" first, to clear the choice.
  const rows: { value: T | undefined; label: string }[] = [{ value: undefined, label: placeholder }, ...options];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const show = () => {
    setActive(Math.max(0, rows.findIndex((r) => r.value === value)));
    setOpen(true);
  };
  const choose = (i: number) => {
    onChange(rows[i].value);
    setOpen(false);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return setOpen(false);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return show();
      setActive((i) => Math.min(rows.length - 1, Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1))));
    }
    if ((e.key === "Enter" || e.key === " ") && open && active >= 0) {
      e.preventDefault();
      choose(active);
    }
  };

  return (
    <div ref={box} className={`relative ${className}`}>
      <button
        type="button"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKey}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-control border border-line-strong bg-surface px-3 text-left text-[15px] text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-tint"
      >
        <span className={`truncate ${current ? "" : "text-muted"}`}>{current?.label ?? placeholder}</span>
        <span aria-hidden="true" className={`text-xs text-muted transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <ul
          ref={list}
          id={id}
          role="listbox"
          aria-label={label}
          className="absolute left-0 top-full z-40 mt-1.5 max-h-72 min-w-full overflow-auto rounded-[14px] border border-line bg-surface py-1.5 text-[14.5px] shadow-[0_8px_24px_rgba(28,32,36,0.12)]"
        >
          {rows.map((r, i) => (
            <li
              key={String(r.value ?? "")}
              id={`${id}-${i}`}
              data-i={i}
              role="option"
              aria-selected={r.value === value}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(i)}
              className={`mx-1.5 cursor-pointer whitespace-nowrap rounded-[10px] px-3 py-2 ${i === active ? "bg-primary-tint text-primary" : ""} ${r.value === value ? "font-semibold" : ""} ${r.value === undefined ? "text-muted" : ""}`}
            >
              {r.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
