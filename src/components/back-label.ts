import { getTranslations } from "next-intl/server";

// Labels for BackLink: where "back" leads.
export async function backLabel(to: "settings" | "users") {
  const t = await getTranslations("nav");
  return to === "settings" ? t("settings") : t("users");
}
