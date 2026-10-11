import { getRequestConfig } from "next-intl/server";

export const locales = ["el", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "el";

// Staff UI is Greek. English is added per screen later (e.g. patient intake forms).
export default getRequestConfig(async () => {
  const locale = defaultLocale;
  return {
    locale,
    timeZone: "Europe/Athens",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
