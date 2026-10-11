import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/current";
import { AuthCard, primaryButton } from "../../ui";

export default async function RecoveryUsedPage({ searchParams }: PageProps<"/login/recovery-used">) {
  await requireSession();
  const left = Math.max(0, Number((await searchParams).left) || 0);
  const t = await getTranslations("twoFactor");
  return (
    <AuthCard title={t("title")}>
      <div className="space-y-4">
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {t("recoveryUsed", { left })}
        </p>
        <Link href="/" className={`${primaryButton} block text-center`}>{t("continue")}</Link>
      </div>
    </AuthCard>
  );
}
