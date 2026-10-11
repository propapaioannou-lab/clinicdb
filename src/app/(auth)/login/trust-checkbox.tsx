import { useTranslations } from "next-intl";

export function TrustCheckbox({ days }: { days: number }) {
  const t = useTranslations("twoFactor");
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" name="trust" className="mt-1" />
      <span>
        {t("trust", { days })}
        <span className="block text-neutral-500">{t("trustWarning")}</span>
      </span>
    </label>
  );
}
