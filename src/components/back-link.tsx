import Link from "next/link";

// "← Ρυθμίσεις" above a page title: the way back to where this page was opened from.
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-hover">
      <span aria-hidden="true">←</span>
      {label}
    </Link>
  );
}
