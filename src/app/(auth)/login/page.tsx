import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentSession } from "@/lib/auth/current";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await getCurrentSession()) redirect("/");
  const t = await getTranslations();
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <p className="text-center text-sm uppercase tracking-wide text-neutral-500">{t("app.name")}</p>
        <h1 className="mb-6 mt-1 text-center text-2xl font-semibold">{t("login.title")}</h1>
        <LoginForm />
      </div>
    </main>
  );
}
