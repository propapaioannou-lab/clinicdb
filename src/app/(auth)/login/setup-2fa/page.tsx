import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import QRCode from "qrcode";
import { getPendingSession } from "@/lib/auth/current";
import { startEnrollment, TRUST_DAYS } from "@/lib/auth/two-factor";
import { AuthCard } from "../../ui";
import { CancelButton } from "../cancel-button";
import { SetupForm } from "./setup-form";

export default async function SetupTwoFactorPage() {
  const pending = await getPendingSession();
  if (!pending) redirect("/login");
  if (pending.stage === "PENDING_2FA") redirect("/login/2fa");
  const { secret, url } = await startEnrollment(pending.user.id);
  const qrSvg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  const t = await getTranslations("setup2fa");
  return (
    <AuthCard title={t("title")}>
      <SetupForm qrSvg={qrSvg} secret={secret} trustDays={TRUST_DAYS} />
      <CancelButton />
    </AuthCard>
  );
}
