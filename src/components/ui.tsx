// Shared look (DESIGN.md tokens): inputs, buttons, cards, badges.

export const inputClass =
  "mt-1 w-full h-11 rounded-control border border-line-strong bg-surface px-3 text-[15px] text-ink " +
  "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-tint disabled:bg-surface-2 disabled:text-muted";

export const textareaClass =
  "mt-1 w-full rounded-control border border-line-strong bg-surface px-3 py-2 text-[15px] text-ink " +
  "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-tint";

export const primaryButton =
  "inline-flex h-11 items-center justify-center gap-2 rounded-control bg-primary px-4 text-[14.5px] font-semibold text-white " +
  "hover:bg-primary-hover disabled:opacity-60";

export const secondaryButton =
  "inline-flex h-11 items-center justify-center gap-2 rounded-control border border-line-strong bg-surface px-4 text-[14.5px] font-medium text-ink " +
  "hover:bg-surface-2 disabled:opacity-60";

export const dangerButton =
  "inline-flex h-11 items-center justify-center gap-2 rounded-control border border-danger/40 bg-surface px-4 text-[14.5px] font-medium text-danger-ink " +
  "hover:bg-danger-bg disabled:opacity-60";

export const card = "rounded-card border border-line bg-surface";

export function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-control bg-danger-bg px-3 py-2 text-sm text-danger-ink">
      {children}
    </p>
  );
}

export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="rounded-control bg-ok-bg px-3 py-2 text-sm text-ok-ink">
      {children}
    </p>
  );
}

export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className={`${card} w-full max-w-sm p-6`}>
        <h1 className="mb-6 text-center text-2xl font-semibold">{title}</h1>
        {children}
      </div>
    </main>
  );
}

export type Tone = "neutral" | "green" | "amber" | "red" | "info" | "primary" | "spa";

const tones: Record<Tone, string> = {
  neutral: "bg-line-softer text-ink-3",
  green: "bg-ok-bg text-ok-ink",
  amber: "bg-warn-bg text-warn-ink",
  red: "bg-danger-bg text-danger-ink",
  info: "bg-info-bg text-info-ink",
  primary: "bg-primary-tint text-primary",
  spa: "bg-spa-bg text-spa-ink",
};

// Small rounded label ("pill").
export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className={`${card} p-5`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// "AB" from "Άννα Βασιλείου": first letters of the first two words, without accents.
export function initials(name: string) {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-avatar font-semibold text-primary"
    >
      {initials(name)}
    </span>
  );
}
