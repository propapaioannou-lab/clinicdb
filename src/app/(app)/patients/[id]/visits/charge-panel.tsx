"use client";

import { useState, useTransition } from "react";
import { Dropdown } from "@/components/dropdown";
import { useTranslations } from "next-intl";
import { card, ErrorBox, inputClass, Notice, primaryButton } from "@/components/ui";
import type { VisitActionState } from "./actions";

const euros = (cents: number | null) => (cents === null ? "" : (cents / 100).toFixed(2).replace(".", ",").replace(",00", ""));

// "Αμοιβή" (DESIGN.md 3): only rendered for Secretary / PA/nurse (decided 11 Oct 2026).
export function ChargePanel({
  money,
  action,
  closeAction,
}: {
  money: { feeCents: number | null; paidCents: number | null; paymentMethod: string | null };
  action: (fd: FormData) => Promise<VisitActionState>;
  // Present while the visit is open: save the payment and close the visit.
  closeAction?: (fd: FormData) => Promise<VisitActionState>;
}) {
  const t = useTranslations("visit");
  const [state, setState] = useState<VisitActionState>({});
  const [pending, start] = useTransition();
  const balance = (money.feeCents ?? 0) - (money.paidCents ?? 0);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const closing = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "close";
        start(async () => setState((await (closing && closeAction ? closeAction(fd) : action(fd))) ?? {}));
      }}
      className={`${card} flex flex-col gap-3 p-5`}
    >
      <h2 className="text-[17px] font-semibold">{t("fee")}</h2>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm text-ink-3">{t("feeAmount")}
          <input name="fee" defaultValue={euros(money.feeCents)} inputMode="decimal" placeholder="0" className={inputClass} />
        </label>
        <label className="block text-sm text-ink-3">{t("paidAmount")}
          <input name="paid" defaultValue={euros(money.paidCents)} inputMode="decimal" placeholder="0" className={inputClass} />
        </label>
      </div>
      <label className="block text-sm text-ink-3">{t("method")}
        <Dropdown
          name="method"
          label={t("method")}
          defaultValue={money.paymentMethod ?? undefined}
          options={(["cash", "card", "transfer"] as const).map((m) => ({ value: m, label: t(`methods.${m}`) }))}
          className="mt-1"
        />
      </label>
      <p className="text-sm text-ink-3">
        {money.feeCents === null ? t("noCharge") : balance > 0 ? t("balanceDue", { amount: euros(balance) }) : t("paidInFull")}
      </p>
      {state.error && <ErrorBox>{t(`errors.${state.error}`)}</ErrorBox>}
      {state.saved && <Notice>{t("chargeSaved")}</Notice>}
      <div className="flex flex-wrap gap-2">
        {closeAction && (
          <button type="submit" value="close" disabled={pending} className={`${primaryButton} w-full`}>{t("saveAndClose")}</button>
        )}
        <button type="submit" value="save" disabled={pending} className={closeAction ? "inline-flex h-11 items-center rounded-control border border-line-strong bg-surface px-4 text-[14.5px] font-medium hover:bg-surface-2" : primaryButton}>
          {t("saveCharge")}
        </button>
        <button type="button" disabled title={t("receiptSoon")} className="inline-flex h-11 items-center rounded-control border border-line-strong px-4 text-[14.5px] text-muted opacity-60">
          {t("receipt")}
        </button>
      </div>
    </form>
  );
}
