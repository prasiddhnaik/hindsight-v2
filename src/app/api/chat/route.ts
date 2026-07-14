import { stepCountIs, streamText } from "ai";

import { assembleContext } from "~/server/ai/assembleContext";
import { parseChatRequest } from "~/server/ai/chatRequest";
import {
  getOwnedConversation,
  maybeSetTitle,
  persistAssistantMessage,
  persistUserMessage,
  uiMessageText,
} from "~/server/ai/chatStore";
import { friendlyErrorMessage } from "~/server/ai/errors";
import { maybeExtractMemories } from "~/server/ai/memory/extract";
import { chatModel } from "~/server/ai/provider";
import {
  monotonicTimestampSupplier,
  replaceIfEligible,
} from "~/server/ai/regeneration";
import { chatTools } from "~/server/ai/tools";
import { repairToolCall } from "~/server/ai/tools/repair";
import { persistToolActivity } from "~/server/ai/toolStore";
import { db } from "~/server/db";
import { getUserId } from "~/server/user";

export const maxDuration = 60;

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseChatRequest(json);
  if (!parsed) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { conversationId } = parsed;
  const action = parsed.action ?? "send";

  const conversation = await getOwnedConversation(conversationId, getUserId());
  if (!conversation) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  try {
    if (parsed.action !== "regenerate") {
      const userText = uiMessageText(parsed.message).trim();
      if (!userText) {
        return Response.json({ error: "Empty message" }, { status: 400 });
      }
      await persistUserMessage(conversationId, userText);
      await maybeSetTitle(conversationId, userText);
    }

    // Every model request passes through the single budgeted gate (§3.3).
    // The SDK requires system content via `system`, never inside `messages`.
    const context = await assembleContext(conversationId, getUserId(), {
      action,
    });
    const result = streamText({
      model: chatModel,
      system: context.system,
      messages: context.messages,
      tools: chatTools,
      stopWhen: stepCountIs(5), // §7.1 — mandatory step cap on every call
      experimental_repairToolCall: repairToolCall,
      // §3.1: failed requests count against the daily quota and 429s must
      // never be auto-retried — disable the SDK's default retry-with-backoff.
      maxRetries: 0,
      onStepFinish: (step) => {
        for (const call of step.toolCalls) {
          const match = step.toolResults.find(
            (r) => r.toolCallId === call.toolCallId,
          );
          console.log(
            `[tools] step: ${call.toolName}(${JSON.stringify(call.input)}) → ${JSON.stringify(match?.output ?? null)?.slice(0, 200)}`,
          );
        }
      },
      onFinish: async ({ finishReason, text, steps }) => {
        if (action === "regenerate") {
          await replaceIfEligible({ finishReason, text, steps }, async () => {
            const nextCreatedAt = monotonicTimestampSupplier(new Date());
            await db.$transaction(async (tx) => {
              const rows = await tx.message.findMany({
                where: { conversationId },
                orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                select: { id: true, role: true },
              });
              let latestUserIndex = rows.length - 1;
              while (
                latestUserIndex >= 0 &&
                rows[latestUserIndex]?.role !== "user"
              ) {
                latestUserIndex -= 1;
              }
              if (latestUserIndex < 0) {
                throw new Error("Cannot regenerate without a user message");
              }
              const responseIds = rows
                .slice(latestUserIndex + 1)
                .map((row) => row.id);
              if (responseIds.length > 0) {
                await tx.message.deleteMany({
                  where: { conversationId, id: { in: responseIds } },
                });
              }
              await persistToolActivity(
                conversationId,
                steps,
                tx,
                nextCreatedAt,
              );
              if (text.trim()) {
                await persistAssistantMessage(
                  conversationId,
                  text,
                  tx,
                  nextCreatedAt,
                );
              }
            });
          });
          return;
        }

        await persistToolActivity(conversationId, steps);
        if (text.trim()) {
          await persistAssistantMessage(conversationId, text);
        }
        // Batched fact extraction, one call per 5 user messages (Phase 4);
        // best-effort and never blocks or breaks the finished stream.
        await maybeExtractMemories(conversationId, getUserId());
      },
    });

    return result.toUIMessageStreamResponse({
      onError: friendlyErrorMessage,
    });
  } catch (error) {
    return Response.json(
      { error: friendlyErrorMessage(error) },
      { status: 500 },
    );
  }
}
