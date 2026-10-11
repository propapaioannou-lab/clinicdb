import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/current";
import { takeRecoveryCodesForDisplay } from "@/lib/auth/two-factor";
import { AuthCard, primaryButton } from "@/components/ui";
import { CodesView } from "./codes-view";

// Shown once right after 2FA setup. Reloading the page does not show them again.
export default async function RecoveryCodesPage() {
  const { sessionId } = await requireSession();
  const codes = await takeRecoveryCodesForDisplay(sessionId);
  const t = await getTranslations("setup2fa");
  return (
    <AuthCard title={t("codesTitle")}>
      {codes ? (
        <CodesView codes={codes} />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{t("alreadyShown")}</p>
          <Link href="/" className={`${primaryButton} w-full`}>{t("continueHome")}</Link>
        </div>
      )}
    </AuthCard>
  );
}
