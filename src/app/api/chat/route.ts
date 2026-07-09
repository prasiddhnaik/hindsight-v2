import { stepCountIs, streamText, type UIMessage } from "ai";
import { z } from "zod";

import { assembleContext } from "~/server/ai/assembleContext";
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
import { chatTools } from "~/server/ai/tools";
import { repairToolCall } from "~/server/ai/tools/repair";
import { persistToolActivity } from "~/server/ai/toolStore";
import { getUserId } from "~/server/user";

export const maxDuration = 60;

// The client sends only the new user message plus the conversation id; the
// database is the source of truth for history (§4). Deep part validation is
// ours since only the text part reaches the model.
const bodySchema = z.object({
  conversationId: z.string().cuid(),
  message: z.object({
    id: z.string(),
    role: z.literal("user"),
    parts: z
      .array(z.object({ type: z.string(), text: z.string().optional() }))
      .min(1),
  }),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { conversationId, message } = parsed.data;

  const conversation = await getOwnedConversation(conversationId, getUserId());
  if (!conversation) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  const userText = uiMessageText(message as UIMessage).trim();
  if (!userText) {
    return Response.json({ error: "Empty message" }, { status: 400 });
  }

  try {
    await persistUserMessage(conversationId, userText);
    await maybeSetTitle(conversationId, userText);

    // Every model request passes through the single budgeted gate (§3.3);
    // the returned messages already start with the system block.
    const result = streamText({
      model: chatModel,
      messages: await assembleContext(conversationId, getUserId()),
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
      onFinish: async ({ text, steps }) => {
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
