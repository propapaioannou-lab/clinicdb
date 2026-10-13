import Link from "next/link";
import { getTranslations } from "next-intl/server";

// Online demo only: on every page, so nobody mistakes it for the real app.
export async function DemoBanner({ open }: { open: number | null }) {
  const t = await getTranslations("demo");
  return (
    <div role="note" className="flex flex-wrap items-center justify-center gap-x-3 bg-warn px-3 py-1 text-center text-[13px] font-semibold text-ink">
      <span>{t("banner")}</span>
      {open !== null && <Link href="/suggestions" className="underline">{t("bannerLink", { count: open })}</Link>}
    </div>
  );
}
