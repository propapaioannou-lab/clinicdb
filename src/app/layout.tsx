import type { Metadata } from "next";
import { Commissioner } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { DemoBanner } from "@/components/demo/demo-banner";
import { getCurrentSession } from "@/lib/auth/current";
import { isDemo } from "@/lib/demo";
import { openSuggestionCount } from "@/lib/demo-suggestions";
import { loadActor } from "@/lib/users/manage";
import "./globals.css";

// Font files are bundled at build time; the browser never contacts Google.
const commissioner = Commissioner({
  variable: "--font-commissioner",
  subsets: ["greek", "latin"],
  weight: ["400", "500", "600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  // The online demo is kept out of search engines.
  return { title: t("name"), description: t("description"), ...(isDemo() && { robots: { index: false, follow: false } }) };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const demo = isDemo();
  // Demo banner: Owners/Admins also get the link to the «💬 Πρόταση» comments.
  let open: number | null = null;
  if (demo) {
    const session = await getCurrentSession();
    if (session && (session.user.level === "OWNER" || session.user.level === "ADMIN")) open = await openSuggestionCount(await loadActor(session.user.id));
  }
  return (
    <html lang={locale} data-demo={demo ? "1" : undefined} className={`${commissioner.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-ground text-ink">
        {demo && <DemoBanner open={open} />}
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
