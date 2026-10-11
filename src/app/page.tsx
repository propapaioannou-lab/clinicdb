import { getTranslations } from "next-intl/server";

export default async function Home() {
  const t = await getTranslations();
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="text-center">
        <p className="text-sm uppercase tracking-wide text-neutral-500">{t("app.name")}</p>
        <h1 className="mt-2 text-3xl font-semibold">{t("home.title")}</h1>
        <p className="mt-4 text-neutral-600 dark:text-neutral-400">{t("home.subtitle")}</p>
      </div>
    </main>
  );
}
