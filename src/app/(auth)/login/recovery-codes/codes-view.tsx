"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { primaryButton, secondaryButton } from "@/components/ui";

export function CodesView({ codes }: { codes: string[] }) {
  const t = useTranslations("setup2fa");
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">{t("codesIntro")}</p>
      <ol className="grid grid-cols-2 gap-2 rounded-md border border-neutral-300 p-3 font-mono text-sm dark:border-neutral-700">
        {codes.map((c) => <li key={c}>{c}</li>)}
      </ol>
      <div className="flex gap-2 print:hidden">
        <button type="button" className={secondaryButton}
          onClick={() => navigator.clipboard.writeText(codes.join("\n")).then(() => setCopied(true))}>
          {copied ? t("copied") : t("copy")}
        </button>
        <button type="button" className={secondaryButton} onClick={() => window.print()}>{t("print")}</button>
      </div>
      <Link href="/" className={`${primaryButton} block text-center print:hidden`}>{t("saved")}</Link>
    </div>
  );
}
