import { generateText } from "ai";

import { COMPACTION_MAX_TOKENS } from "./contextBudget";
import type { HistoryRow } from "./planContext";
import { chatModel } from "./provider";
import { countTokens } from "./tokens";

const COMPACTION_SYSTEM = `You compress chat history. Summarize the conversation span below into at most ${COMPACTION_MAX_TOKENS} tokens. Preserve concrete facts, names, numbers, decisions, preferences, and open questions. Write plain prose, no preamble. If an existing summary is provided, fold it in — the result must stand alone as the single summary of everything so far.`;

/**
 * One compaction call is capped to this much span input; anything beyond is
 * left uncovered and rolled up by later calls. Keeps the call fast enough
 * for the route's 60s budget and inside the model's reliable range.
 */
const COMPACTION_INPUT_BUDGET = 24_000;

export interface CompactionResult {
  summary: string;
  /** The last row actually folded into the summary. */
  coveredThroughId: string;
}

/**
 * Rolls `existingSummary` plus the oldest ≤24K tokens of the dropped span
 * into a fresh standalone summary (§6.3). Deviation from the spec's "prepend
 * new to existing" wording: re-summarizing the combination keeps chronology
 * intact and makes the separate re-compaction step unnecessary — the result
 * is always ≤ ~300 tokens by construction.
 *
 * Throws on failure; the caller treats compaction as best-effort.
 */
export async function compactSpan(
  existingSummary: string | null,
  droppedSpan: HistoryRow[],
): Promise<CompactionResult> {
  if (droppedSpan.length === 0) throw new Error("empty compaction span");

  const included: HistoryRow[] = [];
  let used = 0;
  for (const row of droppedSpan) {
    if (included.length > 0 && used + row.tokenCount > COMPACTION_INPUT_BUDGET)
      break;
    included.push(row);
    used += row.tokenCount;
  }
  const spanText = included
    .map((row) => `${row.role}: ${row.content}`)
    .join("\n");

  const prompt = existingSummary
    ? `Existing summary:\n${existingSummary}\n\nNew span to fold in:\n${spanText}`
    : `Span to summarize:\n${spanText}`;

  const { text } = await generateText({
    model: chatModel,
    system: COMPACTION_SYSTEM,
    prompt,
    maxOutputTokens: COMPACTION_MAX_TOKENS + 60, // headroom for tokenizer mismatch
    maxRetries: 0, // §3.1 — a failed compaction must not burn quota retrying
  });

  const summary = text.trim();
  if (!summary) throw new Error("compaction returned empty text");
  console.log(
    `[compaction] folded ${included.length}/${droppedSpan.length} rows (~${used} tokens) into ${countTokens(summary)}-token summary`,
  );
  return { summary, coveredThroughId: included[included.length - 1]!.id };
}
