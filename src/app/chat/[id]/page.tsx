import { notFound } from "next/navigation";

import { Chat } from "~/app/_components/chat";
import { getOwnedConversation, loadUIMessages } from "~/server/ai/chatStore";
import { getUserId } from "~/server/user";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const conversation = await getOwnedConversation(id, getUserId());
  if (!conversation) notFound();

  const initialMessages = await loadUIMessages(id);

  // key remounts the chat when switching conversations so state never bleeds.
  return <Chat key={id} conversationId={id} initialMessages={initialMessages} />;
}
