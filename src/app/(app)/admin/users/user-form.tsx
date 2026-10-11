"use client";

import Link from "next/link";
import { Dropdown } from "@/components/dropdown";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { Level, Role } from "@/generated/prisma/client";
import { ErrorBox, inputClass, Notice, primaryButton, secondaryButton } from "@/components/ui";
import type { FormState } from "../actions";
import { PasswordReveal } from "../password-reveal";

const ROLE_OPTIONS: Role[] = ["SURGEON", "PA_NURSE", "SECRETARY", "SPA_STAFF", "OTHER"];

type Company = { id: string; name: string; canGrant: boolean };

export type UserFormProps = {
  mode: "create" | "edit";
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  levels: Level[]; // levels this admin may choose
  companies: Company[];
  initial: { name: string; email: string; level: Level; role: Role; companyIds: string[]; guestEnd: string };
  locked?: { level?: boolean; all?: boolean };
};

export function UserForm({ mode, action, levels, companies, initial, locked = {} }: UserFormProps) {
  const t = useTranslations("admin");
  const tl = useTranslations("levels");
  const tr = useTranslations("roles");
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const [level, setLevel] = useState<Level>(initial.level);
  const all = !!locked.all;

  if (mode === "create" && state.password) {
    return (
      <div className="space-y-4">
        <PasswordReveal password={state.password} />
        <Link href="/admin/users" className={`${primaryButton} w-full`}>{t("form.cancel")}</Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <fieldset disabled={all} className="space-y-4">
        <label className="block text-sm font-medium">
          {t("form.name")}
          <input name="name" required defaultValue={initial.name} className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          {t("form.email")}
          <input name="email" type="email" required defaultValue={initial.email} disabled={mode === "edit"} className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          {t("form.level")}
          <Dropdown
            name={locked.level ? undefined : "level"}
            label={t("form.level")}
            value={level}
            onChange={(v) => v && setLevel(v)}
            disabled={locked.level}
            placeholder={null}
            options={levels.map((l) => ({ value: l, label: tl(l) }))}
            className="mt-1"
          />
          <span className="mt-1 block text-xs font-normal text-neutral-500">{t(`form.levelHelp.${level}`)}</span>
          {locked.level && <input type="hidden" name="level" value={level} />}
        </label>
        <label className="block text-sm font-medium">
          {t("form.role")}
          <Dropdown
            name="role"
            label={t("form.role")}
            defaultValue={initial.role}
            placeholder={null}
            options={ROLE_OPTIONS.map((r) => ({ value: r, label: tr(r) }))}
            className="mt-1"
          />
          <span className="mt-1 block text-xs font-normal text-neutral-500">{t("form.roleHelp")}</span>
        </label>
        {level === "GUEST" && (
          <label className="block text-sm font-medium">
            {t("form.guestEnd")}
            <input name="guestEnd" type="date" required defaultValue={initial.guestEnd} className={inputClass} />
          </label>
        )}
        <fieldset className="text-sm">
          <legend className="font-medium">{t("form.companies")}</legend>
          {companies.map((c) => (
            <label key={c.id} className="mt-1 flex items-center gap-2">
              <input type="checkbox" name="company" value={c.id} defaultChecked={initial.companyIds.includes(c.id)} disabled={!c.canGrant} />
              {c.name}
            </label>
          ))}
        </fieldset>
        {mode === "create" && (
          <fieldset className="text-sm">
            <legend className="font-medium">{t("form.method")}</legend>
            <label className="mt-1 flex items-center gap-2"><input type="radio" name="method" value="invite" defaultChecked />{t("form.methodInvite")}</label>
            <label className="mt-1 flex items-center gap-2"><input type="radio" name="method" value="password" />{t("form.methodPassword")}</label>
          </fieldset>
        )}
      </fieldset>
      {state.error && <ErrorBox>{t(`errors.${state.error}`)}</ErrorBox>}
      {state.saved && <Notice>{t("form.saved")}</Notice>}
      {!all && (
        <div className="flex gap-2">
          <button type="submit" disabled={pending} className={`${primaryButton} w-full`}>
            {pending ? t("form.saving") : mode === "create" ? t("form.create") : t("form.save")}
          </button>
          <Link href="/admin/users" className={secondaryButton}>{t("form.cancel")}</Link>
        </div>
      )}
    </form>
  );
}
