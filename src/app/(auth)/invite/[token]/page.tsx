import { getTranslations } from "next-intl/server";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { findValidInvitation } from "@/lib/users/invitations";
import { AuthCard } from "@/components/ui";
import { InviteForm } from "./invite-form";

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const t = await getTranslations("invite");
  const inv = await findValidInvitation(token);
  if (!inv) {
    return (
      <AuthCard title={t("invalidTitle")}>
        <p className="text-center text-sm text-neutral-600 dark:text-neutral-400">{t("invalid")}</p>
      </AuthCard>
    );
  }
  return (
    <AuthCard title={t("title")}>
      <p className="mb-1 font-medium">{t("hello", { name: inv.user.name })}</p>
      <p className="mb-6 text-sm text-neutral-600 dark:text-neutral-400">{t("intro", { email: inv.user.email })}</p>
      <InviteForm token={token} minLength={MIN_PASSWORD_LENGTH} />
    </AuthCard>
  );
}
