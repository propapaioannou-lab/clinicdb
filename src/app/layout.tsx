import type { Metadata } from "next";
import { Commissioner } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "./globals.css";

// Font files are bundled at build time; the browser never contacts Google.
const commissioner = Commissioner({
  variable: "--font-commissioner",
  subsets: ["greek", "latin"],
  weight: ["400", "500", "600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return { title: t("name"), description: t("description") };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${commissioner.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-ground text-ink">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
