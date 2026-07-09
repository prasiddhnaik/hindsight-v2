import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { z } from "zod";

import { friendlyErrorMessage } from "~/server/ai/errors";
import { chatModel } from "~/server/ai/provider";
import { SYSTEM_PROMPT } from "~/server/ai/systemPrompt";

export const maxDuration = 60;

// Minimal shape check on the untrusted body; convertToModelMessages does the
// deep structural validation of UIMessage parts and throws on garbage.
const bodySchema = z.object({
  messages: z.array(z.record(z.unknown())).min(1),
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
  const messages = parsed.data.messages as unknown as UIMessage[];

  try {
    const result = streamText({
      model: chatModel,
      system: SYSTEM_PROMPT,
      messages: await convertToModelMessages(messages),
      // §3.1: failed requests count against the daily quota and 429s must
      // never be auto-retried — disable the SDK's default retry-with-backoff.
      maxRetries: 0,
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
