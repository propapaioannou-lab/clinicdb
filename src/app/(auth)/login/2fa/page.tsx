import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPendingSession } from "@/lib/auth/current";
import { TRUST_DAYS } from "@/lib/auth/two-factor";
import { AuthCard } from "@/components/ui";
import { CancelButton } from "../cancel-button";
import { CodeForm } from "./code-form";

export default async function TwoFactorPage() {
  const pending = await getPendingSession();
  if (!pending) redirect("/login");
  if (pending.stage === "PENDING_ENROLL") redirect("/login/setup-2fa");
  const t = await getTranslations("twoFactor");
  return (
    <AuthCard title={t("title")}>
      <CodeForm trustDays={TRUST_DAYS} />
      <CancelButton />
    </AuthCard>
  );
}
