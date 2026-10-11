import { getTranslations } from "next-intl/server";
import type { Level } from "@/generated/prisma/client";
import { canAssignLevel } from "@/lib/permissions";
import { listCompanies } from "@/lib/users/queries";
import { createUserAction } from "../../actions";
import { requireManager } from "../../guard";
import { UserForm } from "../user-form";

const ALL_LEVELS: Level[] = ["OWNER", "ADMIN", "USER", "GUEST"];

export default async function NewUserPage() {
  const { actor } = await requireManager();
  const companies = await listCompanies();
  const t = await getTranslations("admin.users");
  const canGrant = (id: string) => actor.level === "OWNER" || actor.companyIds.includes(id);
  return (
    <main className="mx-auto w-full max-w-lg p-4">
      <h1 className="mb-4 text-2xl font-semibold">{t("new")}</h1>
      <UserForm
        mode="create"
        action={createUserAction}
        levels={ALL_LEVELS.filter((l) => canAssignLevel(actor.level, l))}
        companies={companies.map((c) => ({ id: c.id, name: c.name, canGrant: canGrant(c.id) }))}
        initial={{ name: "", email: "", level: "USER", role: "OTHER", companyIds: [], guestEnd: "" }}
      />
    </main>
  );
}
