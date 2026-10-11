import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/current";

export default async function Home() {
  const { user } = await requireSession();
  const t = await getTranslations("home");
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-3xl font-semibold">{t("title", { name: user.name })}</h1>
        <p className="mt-4 text-neutral-600 dark:text-neutral-400">{t("subtitle")}</p>
      </div>
    </main>
  );
}
