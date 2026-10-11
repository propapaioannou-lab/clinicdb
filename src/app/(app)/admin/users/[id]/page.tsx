import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import type { Level } from "@/generated/prisma/client";
import { Badge, dangerButton, ErrorBox, Notice, Section, secondaryButton } from "@/components/ui";
import { canChangeLevel, canManageUser, canRemoveUser } from "@/lib/permissions";
import { athensIsoDate } from "@/lib/time";
import { describeDevice } from "@/lib/user-agent";
import type { ManageError } from "@/lib/users/manage";
import { getUserDetail, listCompanies } from "@/lib/users/queries";
import {
  deleteUserAction,
  endAllSessionsAction,
  generatePasswordAction,
  removeTrustAction,
  resendInviteAction,
  reactivateAction,
  resetTwoFactorAction,
  suspendAction,
  unlockAction,
  updateUserAction,
} from "../../actions";
import { ConfirmButton } from "../../confirm-button";
import { requireManager } from "../../guard";
import { SessionTable } from "../../devices/session-table";
import { UserForm } from "../user-form";
import { GeneratePassword } from "./generate-password";

const ALL_LEVELS: Level[] = ["OWNER", "ADMIN", "USER", "GUEST"];
const NOTICES = ["invited", "resent", "reset2faDone", "unlocked", "endedAll", "trustRemoved", "suspended", "reactivated"] as const;

export default async function UserPage({ params, searchParams }: PageProps<"/admin/users/[id]">) {
  const { actor, session } = await requireManager();
  const { id } = await params;
  const sp = await searchParams;
  const user = await getUserDetail(id);
  if (!user) notFound();
  const companies = await listCompanies();
  const t = await getTranslations("admin");
  const tl = await getTranslations("levels");
  const ta = await getTranslations("audit");
  const format = await getFormatter();
  const when = (d: Date) => format.dateTime(d, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

  const isSelf = actor.id === user.id;
  const manageable = canManageUser(actor.level, user.level);
  const removable = !isSelf && canRemoveUser(actor.level, user.level);
  const levels = ALL_LEVELS.filter((l) => l === user.level || (!isSelf && canChangeLevel(actor.level, user.level, l)));
  const canGrant = (cid: string) => actor.level === "OWNER" || actor.companyIds.includes(cid);
  const notice = NOTICES.find((n) => n === sp.notice);
  const created = sp.notice === "mailFailed" ? "mailFailed" : null;
  const error = typeof sp.error === "string" ? (sp.error as ManageError) : null;

  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold">{user.name}</h1>
        <Badge>{tl(user.level)}</Badge>
        <Badge tone={user.status === "active" ? "green" : user.status === "locked" ? "red" : "amber"}>{t(`status.${user.status}`)}</Badge>
      </div>
      <p className="text-sm text-neutral-500">
        {user.email} · <Link href={`/admin/audit?user=${user.id}`} className="underline-offset-2 hover:underline">{ta("history")}</Link>
      </p>

      {notice === "invited" && <Notice>{t("created.invited", { email: user.email })}</Notice>}
      {notice && notice !== "invited" && <Notice>{t(`detail.${notice}`)}</Notice>}
      {created && <ErrorBox>{t("created.mailFailed")}</ErrorBox>}
      {error && <ErrorBox>{t(`errors.${error}`)}</ErrorBox>}
      {user.level === "OWNER" && <p className="text-sm text-neutral-500">{manageable ? t("detail.ownerProtected") : t("detail.readOnlyOwner")}</p>}

      <Section title={t("detail.account")}>
        <UserForm
          mode="edit"
          action={updateUserAction.bind(null, user.id)}
          levels={levels}
          companies={companies.map((c) => ({ id: c.id, name: c.name, canGrant: manageable && canGrant(c.id) }))}
          initial={{
            name: user.name,
            email: user.email,
            level: user.level,
            role: user.role,
            companyIds: user.companyIds,
            guestEnd: user.accessExpiresAt ? athensIsoDate(user.accessExpiresAt) : "",
          }}
          locked={{ all: !manageable, level: levels.length <= 1 }}
        />
        <dl className="mt-4 grid grid-cols-2 gap-1 text-sm text-neutral-600 dark:text-neutral-400">
          <dt>{t("detail.created")}</dt><dd>{when(user.createdAt)}</dd>
          <dt>{t("users.lastLogin")}</dt><dd>{user.lastLoginAt ? when(user.lastLoginAt) : t("users.never")}</dd>
          <dt>{t("users.twoFactor")}</dt><dd>{user.twoFactor ? t("users.yes") : t("users.no")}</dd>
          {user.invitation && (
            <>
              <dt>{t("detail.invitation")}</dt>
              <dd>{user.invitation.expired ? t("detail.invitationExpired") : t("detail.invitationValid", { date: when(user.invitation.expiresAt) })}</dd>
            </>
          )}
          {user.status === "locked" && user.lockedUntil && (
            <><dt /><dd className="text-red-700 dark:text-red-300">{t("detail.lockedUntil", { date: when(user.lockedUntil) })}</dd></>
          )}
        </dl>
      </Section>

      {manageable && (
        <Section title={t("detail.actions")}>
          <div className="flex flex-wrap gap-2">
            {user.status === "invited" && (
              <form action={resendInviteAction.bind(null, user.id)}>
                <button type="submit" className={secondaryButton}>{t("detail.resend")}</button>
              </form>
            )}
            <GeneratePassword action={generatePasswordAction.bind(null, user.id)} />
            {user.twoFactor && (
              <form action={resetTwoFactorAction.bind(null, user.id)}>
                <ConfirmButton message={t("detail.reset2faConfirm")} className={secondaryButton}>{t("detail.reset2fa")}</ConfirmButton>
              </form>
            )}
            {user.status === "locked" && (
              <form action={unlockAction.bind(null, user.id)}>
                <button type="submit" className={secondaryButton}>{t("detail.unlock")}</button>
              </form>
            )}
            {removable && user.isActive && (
              <form action={suspendAction.bind(null, user.id)}>
                <ConfirmButton message={t("detail.suspendConfirm")} className={secondaryButton}>{t("detail.suspend")}</ConfirmButton>
              </form>
            )}
            {!user.isActive && (
              <form action={reactivateAction.bind(null, user.id)}>
                <button type="submit" className={secondaryButton}>{t("detail.reactivate")}</button>
              </form>
            )}
            {removable && (
              <form action={deleteUserAction.bind(null, user.id)}>
                <ConfirmButton message={t("detail.deleteConfirm")} className={dangerButton}>{t("detail.delete")}</ConfirmButton>
              </form>
            )}
          </div>
        </Section>
      )}

      <Section title={t("devices.title")}>
        <SessionTable rows={user.sessions} currentSessionId={session.sessionId} returnTo={`/admin/users/${user.id}`} />
        {manageable && user.sessions.length > 1 && (
          <form action={endAllSessionsAction.bind(null, user.id)} className="mt-3">
            <button type="submit" className={secondaryButton}>{t("devices.endAll")}</button>
          </form>
        )}
      </Section>

      <Section title={t("devices.trustedTitle")}>
        {user.trustedDevices.length === 0 ? (
          <p className="text-sm text-neutral-500">{t("devices.trustedNone")}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {user.trustedDevices.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-2 dark:border-neutral-900">
                <span>
                  {describeDevice(d.userAgent)} · <span className="font-mono text-xs">{d.ip ?? "—"}</span>
                  <span className="block text-xs text-neutral-500">
                    {t("devices.trustedSince")} {when(d.createdAt)} · {t("devices.trustedUntil")} {when(d.expiresAt)}
                    {d.lastUsedAt && <> · {t("devices.lastUsed")} {when(d.lastUsedAt)}</>}
                  </span>
                </span>
                {manageable && (
                  <form action={removeTrustAction.bind(null, d.id, user.id)}>
                    <button type="submit" className={secondaryButton}>{t("devices.removeTrust")}</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </main>
  );
}
