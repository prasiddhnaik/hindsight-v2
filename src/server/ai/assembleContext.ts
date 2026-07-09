import { db } from "~/server/db";
import { compactSpan } from "./compaction";
import { COMPACTION_MIN_NEW_MESSAGES } from "./contextBudget";
import {
  planContext,
  type ContextPlan,
  type HistoryRow,
} from "./planContext";
import { SYSTEM_PROMPT } from "./systemPrompt";

/**
 * The single gate every model request goes through (§3.3, §6). Loads state
 * from the database (the source of truth), plans a token-budgeted context,
 * and runs best-effort compaction when trimmed history isn't yet covered by
 * the rolling summary.
 */
export async function assembleContext(
  conversationId: string,
  userId: string,
): Promise<Pick<ContextPlan, "system" | "messages">> {
  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, userId },
    select: { summary: true, summaryUpToMessageId: true },
  });
  if (!conversation) throw new Error("conversation not found");

  const dbRows = await db.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, content: true, tokenCount: true },
  });
  const rows: HistoryRow[] = dbRows.map((row) => ({
    ...row,
    role: row.role as HistoryRow["role"],
  }));

  // 10 most recent long-term memories; injected as untrusted data (§3.4).
  // Extraction that fills this table arrives in Phase 4.
  const memories = await db.memory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { content: true },
  });

  const planInput = {
    systemPrompt: SYSTEM_PROMPT,
    memories: memories.map((m) => m.content),
    summary: conversation.summary,
    rows,
  };
  let plan = planContext(planInput);

  for (const warning of plan.warnings) {
    console.warn(`[assembleContext] ${conversationId}: ${warning}`);
  }

  // --- best-effort rolling compaction of dropped, not-yet-covered rows ---
  if (plan.droppedRows.length > 0) {
    const coveredIndex = conversation.summaryUpToMessageId
      ? rows.findIndex((r) => r.id === conversation.summaryUpToMessageId)
      : -1;
    const idToIndex = new Map(rows.map((r, i) => [r.id, i]));
    const uncovered = plan.droppedRows.filter(
      (r) => (idToIndex.get(r.id) ?? -1) > coveredIndex,
    );

    // Rate limit (§6.3): once per 10 new messages after the first summary.
    const threshold = conversation.summary ? COMPACTION_MIN_NEW_MESSAGES : 1;
    if (uncovered.length >= threshold) {
      try {
        const { summary, coveredThroughId } = await compactSpan(
          conversation.summary,
          uncovered,
        );
        await db.conversation.update({
          where: { id: conversationId },
          data: { summary, summaryUpToMessageId: coveredThroughId },
        });
        plan = planContext({ ...planInput, summary });
      } catch (error) {
        // Compaction must never break the chat — proceed with the old summary.
        console.warn(`[assembleContext] compaction failed, continuing:`, error);
      }
    }
  }

  console.log(
    `[assembleContext] ${conversationId}: ${plan.messages.length} messages, ~${plan.totalTokens} tokens (cap incl. margin), dropped ${plan.droppedRows.length} rows`,
  );
  return { system: plan.system, messages: plan.messages };
}
