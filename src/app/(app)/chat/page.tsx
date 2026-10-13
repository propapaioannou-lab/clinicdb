import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChatBox } from "@/components/chat/chat-box";
import { requireSession } from "@/lib/auth/current";
import { presetsFor, recentMessages } from "@/lib/chat/chat";
import { activeCompany } from "@/lib/company";
import { loadActor } from "@/lib/users/manage";

// «Chat» (bottom bar on phones, 6a-10): the staff chat on its own page.
export default async function ChatPage() {
  const session = await requireSession();
  const actor = await loadActor(session.user.id);
  const company = await activeCompany(actor);
  if (!company) notFound();
  const [lines, presets] = await Promise.all([recentMessages(actor, company.id, 100), presetsFor(actor, company.id)]);
  if (!lines) notFound();
  const t = await getTranslations("chat");
  return (
    <main className="mx-auto flex w-full max-w-[760px] flex-col gap-4 px-4 py-5 md:px-8">
      <ChatBox companyId={company.id} meId={actor.id} initial={lines} presets={presets} title={t("title")} tall />
    </main>
  );
}
