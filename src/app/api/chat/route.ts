import { streamText, type UIMessage } from "ai";
import { z } from "zod";

import {
  getOwnedConversation,
  loadModelMessages,
  maybeSetTitle,
  persistAssistantMessage,
  persistUserMessage,
  uiMessageText,
} from "~/server/ai/chatStore";
import { friendlyErrorMessage } from "~/server/ai/errors";
import { chatModel } from "~/server/ai/provider";
import { SYSTEM_PROMPT } from "~/server/ai/systemPrompt";
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

    const result = streamText({
      model: chatModel,
      system: SYSTEM_PROMPT,
      messages: await loadModelMessages(conversationId),
      // §3.1: failed requests count against the daily quota and 429s must
      // never be auto-retried — disable the SDK's default retry-with-backoff.
      maxRetries: 0,
      onFinish: async ({ text }) => {
        if (text.trim()) {
          await persistAssistantMessage(conversationId, text);
        }
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
