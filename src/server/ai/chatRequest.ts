import type { UIMessage } from "ai";
import { z } from "zod";

export type ChatRequest =
  | { action?: "send"; conversationId: string; message: UIMessage }
  | { action: "regenerate"; conversationId: string };

const messageSchema = z.object({
  id: z.string(),
  role: z.literal("user"),
  parts: z
    .array(z.object({ type: z.string(), text: z.string().optional() }))
    .min(1),
});

const chatRequestSchema = z.union([
  z
    .object({
      action: z.literal("send").optional(),
      conversationId: z.string().cuid(),
      message: messageSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("regenerate"),
      conversationId: z.string().cuid(),
    })
    .strict(),
]);

export function parseChatRequest(input: unknown): ChatRequest | null {
  const parsed = chatRequestSchema.safeParse(input);
  return parsed.success ? (parsed.data as ChatRequest) : null;
}
