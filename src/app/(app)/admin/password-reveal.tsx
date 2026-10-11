"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { secondaryButton } from "@/components/ui";

// A generated password, shown once.
export function PasswordReveal({ password }: { password: string }) {
  const t = useTranslations("admin.created");
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
      <p>{t("password")}</p>
      <p className="text-center font-mono text-lg tracking-wider">{password}</p>
      <button type="button" className={secondaryButton} onClick={() => navigator.clipboard.writeText(password).then(() => setCopied(true))}>
        {copied ? t("copied") : t("copy")}
      </button>
    </div>
  );
}
