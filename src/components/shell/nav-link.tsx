"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// A left-menu entry; highlighted when its section is open. Later-phase entries are
// shown greyed out with "σύντομα" (DESIGN.md "Screen → phase").
export function NavLink({
  href,
  match,
  icon,
  label,
  soon,
  badge,
  variant = "side",
}: {
  href: string;
  match?: string[];
  icon: React.ReactNode;
  label: string;
  soon?: string;
  badge?: React.ReactNode;
  variant?: "side" | "bottom";
}) {
  const path = usePathname();
  const prefixes = match ?? [href];
  const active = prefixes.some((p) => (p === "/" ? path === "/" : path === p || path.startsWith(`${p}/`)));

  if (variant === "bottom") {
    const cls = `flex flex-1 flex-col items-center gap-1 py-2 text-[11.5px] ${active ? "font-semibold text-primary" : "text-ink-3"}`;
    if (soon) return <span aria-disabled="true" title={soon} className={`${cls} opacity-45`}>{icon}{label}</span>;
    return <Link href={href} aria-current={active ? "page" : undefined} className={cls}>{icon}{label}</Link>;
  }

  if (soon) {
    return (
      <span aria-disabled="true" className="flex items-center gap-3 rounded-[9px] px-3 py-[11px] text-[14.5px] text-ink-2 opacity-45">
        {icon}
        <span className="flex-1">{label}</span>
        <span className="text-[11px] font-medium">{soon}</span>
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-[9px] px-3 py-[11px] text-[14.5px] ${active ? "bg-primary-tint font-semibold text-primary" : "text-ink-2 hover:bg-surface-2"}`}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {badge}
    </Link>
  );
}
