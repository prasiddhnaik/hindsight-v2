import type { UIMessage } from "ai";

import { db } from "~/server/db";
import { countTokens } from "./tokens";

/** Extracts plain text from a UIMessage's parts. */
export function uiMessageText(message: UIMessage): string {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");
}

/** Returns the conversation iff it exists and belongs to the user. */
export async function getOwnedConversation(
  conversationId: string,
  userId: string,
) {
  return db.conversation.findFirst({
    where: { id: conversationId, userId },
  });
}

export async function persistUserMessage(
  conversationId: string,
  content: string,
): Promise<void> {
  await db.message.create({
    data: {
      conversationId,
      role: "user",
      content,
      tokenCount: countTokens(content),
    },
  });
}

export async function persistAssistantMessage(
  conversationId: string,
  content: string,
): Promise<void> {
  await db.message.create({
    data: {
      conversationId,
      role: "assistant",
      content,
      tokenCount: countTokens(content),
    },
  });
  // Touch updatedAt so the sidebar orders by recent activity.
  await db.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
}

/**
 * Sets the conversation title from the first user message, once.
 */
export async function maybeSetTitle(
  conversationId: string,
  firstUserText: string,
): Promise<void> {
  const title = firstUserText.trim().replace(/\s+/g, " ").slice(0, 60);
  if (!title) return;
  await db.conversation.updateMany({
    where: { id: conversationId, title: "New chat" },
    data: { title },
  });
}

/** DB messages → UIMessages for useChat's initialMessages. */
export async function loadUIMessages(
  conversationId: string,
): Promise<UIMessage[]> {
  const rows = await db.message.findMany({
    where: { conversationId, role: { in: ["user", "assistant"] } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    role: row.role as "user" | "assistant",
    parts: [{ type: "text", text: row.content }],
  }));
}
