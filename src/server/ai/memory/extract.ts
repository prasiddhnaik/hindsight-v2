import { generateText } from "ai";
import { z } from "zod";

import { db } from "~/server/db";
import { chatModel } from "../provider";
import { countTokens } from "../tokens";

const EXTRACTION_SYSTEM = `You extract durable facts about the user from a conversation transcript. Respond ONLY with a JSON array of 0 to 3 short strings — no prose, no code fences. Each string is one lasting fact about the user (preferences, identity, projects, constraints), e.g. "User is vegetarian". Ignore temporary context, one-off questions, and anything about the assistant. Return [] if there are no new durable facts.`;

const factsSchema = z.array(z.string().min(3).max(300)).max(10);

/** Every Nth user message triggers one batched extraction call (§ Phase 4). */
const EXTRACTION_EVERY_N_USER_MESSAGES = 5;
/** Transcript slice fed to extraction. */
const TRANSCRIPT_MESSAGES = 10;
const TRANSCRIPT_TOKENS_PER_MESSAGE = 500;

function normalize(fact: string): string {
  return fact
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tolerates fences/prose around the JSON array the model was asked for. */
function parseFacts(raw: string): string[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end <= start) return [];
  try {
    return factsSchema.parse(JSON.parse(raw.slice(start, end + 1))).slice(0, 3);
  } catch {
    return [];
  }
}

/**
 * Called after each completed exchange; runs one extraction call per 5 user
 * messages (rate-limit discipline, §3.1). Best-effort: failures are logged
 * and skipped, never surfaced to the chat.
 */
export async function maybeExtractMemories(
  conversationId: string,
  userId: string,
): Promise<void> {
  try {
    const userMessageCount = await db.message.count({
      where: { conversationId, role: "user" },
    });
    if (
      userMessageCount === 0 ||
      userMessageCount % EXTRACTION_EVERY_N_USER_MESSAGES !== 0
    )
      return;

    const recent = await db.message.findMany({
      where: { conversationId, role: { in: ["user", "assistant"] } },
      orderBy: { createdAt: "desc" },
      take: TRANSCRIPT_MESSAGES,
    });
    recent.reverse();
    const transcript = recent
      .map((m) => {
        let content = m.content;
        while (countTokens(content) > TRANSCRIPT_TOKENS_PER_MESSAGE) {
          content = content.slice(0, Math.floor(content.length * 0.8));
        }
        return `${m.role}: ${content}`;
      })
      .join("\n");

    const { text } = await generateText({
      model: chatModel,
      system: EXTRACTION_SYSTEM,
      prompt: transcript,
      maxOutputTokens: 300,
      maxRetries: 0, // §3.1
    });

    const facts = parseFacts(text);
    if (facts.length === 0) {
      console.log("[memory] extraction ran, no durable facts found");
      return;
    }

    // Dedupe against existing memories: skip near-identical content.
    const existing = await db.memory.findMany({
      where: { userId },
      select: { content: true },
    });
    const existingNormalized = existing.map((m) => normalize(m.content));
    const fresh = facts.filter((fact) => {
      const n = normalize(fact);
      return !existingNormalized.some(
        (e) => e === n || e.includes(n) || n.includes(e),
      );
    });

    if (fresh.length > 0) {
      await db.memory.createMany({
        data: fresh.map((content) => ({ userId, content })),
      });
    }
    console.log(
      `[memory] extracted ${facts.length} fact(s), stored ${fresh.length} new`,
    );
  } catch (error) {
    console.warn("[memory] extraction failed (skipping):", error);
  }
}
