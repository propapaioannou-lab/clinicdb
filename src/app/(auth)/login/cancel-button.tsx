import { useTranslations } from "next-intl";
import { cancelLoginAction } from "./two-factor-actions";

export function CancelButton() {
  const t = useTranslations("twoFactor");
  return (
    <form action={cancelLoginAction} className="mt-4 text-center">
      <button type="submit" className="text-sm text-neutral-500 underline">{t("cancel")}</button>
    </form>
  );
}
