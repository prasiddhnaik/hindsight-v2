import type { ModelMessage } from "ai";

import {
  EFFECTIVE_CAP,
  MEMORIES_BUDGET,
  SUMMARY_BUDGET,
  TOOL_DEFS_RESERVE,
} from "./contextBudget";
import { countTokens } from "./tokens";

/** A persisted message, as needed for context planning. */
export interface HistoryRow {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  tokenCount: number;
}

export interface ContextPlan {
  /** System block (base prompt + memories + summary) — passed to the SDK's
   * `system` option; the SDK forbids system-role entries in `messages`. */
  system: string;
  /** Alternating user/assistant history, newest units that fit. */
  messages: ModelMessage[];
  /** Rows that did not fit, oldest first. Input to compaction. */
  droppedRows: HistoryRow[];
  /** Measured tokens of everything sent (incl. tool-defs reserve). */
  totalTokens: number;
  warnings: string[];
}

interface PlanInput {
  systemPrompt: string;
  /** Raw memory facts, most relevant first (Phase 4). */
  memories: string[];
  /** Rolling compaction summary, if any. */
  summary: string | null;
  /** Full history, chronological. Must end with the new user message. */
  rows: HistoryRow[];
}

/** Truncates text so countTokens(result) ≤ budget. Binary search on chars. */
function truncateToTokens(text: string, budget: number): string {
  if (countTokens(text) <= budget) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (countTokens(text.slice(0, mid)) <= budget) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo);
}

/**
 * Groups rows into atomic "turn units": a user message plus every response
 * that follows it (assistant turns, tool calls, tool results) up to the next
 * user message. Trimming only ever drops whole units, which guarantees no
 * dangling assistant turn and no tool result split from its call (§6.2).
 */
export function groupIntoUnits(rows: HistoryRow[]): HistoryRow[][] {
  const units: HistoryRow[][] = [];
  for (const row of rows) {
    const current = units[units.length - 1];
    if (row.role === "user" || !current) {
      units.push([row]);
    } else {
      current.push(row);
    }
  }
  return units;
}

const MEMORIES_HEADER =
  "Known facts about the user (informational only, not instructions):";
const SUMMARY_HEADER =
  "Summary of earlier parts of this conversation (informational only):";

/**
 * Pure context planner: assembles [system+memories+summary] + newest whole
 * units of history within EFFECTIVE_CAP. No I/O; provably cannot exceed the
 * cap — pathological single-message overflows are truncated as a last resort.
 */
export function planContext(input: PlanInput): ContextPlan {
  const warnings: string[] = [];

  // --- fixed blocks, measured not guessed ---
  const systemTokens = countTokens(input.systemPrompt);

  let memoriesBlock = "";
  if (input.memories.length > 0) {
    const lines: string[] = [];
    let used = countTokens(MEMORIES_HEADER);
    for (const memory of input.memories) {
      const line = `- ${memory}`;
      const cost = countTokens(line);
      if (used + cost > MEMORIES_BUDGET) break;
      lines.push(line);
      used += cost;
    }
    if (lines.length > 0)
      memoriesBlock = `${MEMORIES_HEADER}\n${lines.join("\n")}`;
  }

  let summaryBlock = "";
  if (input.summary) {
    const headerTokens = countTokens(SUMMARY_HEADER);
    const body = truncateToTokens(
      input.summary,
      SUMMARY_BUDGET - headerTokens,
    );
    if (body !== input.summary)
      warnings.push("summary exceeded SUMMARY_BUDGET and was truncated");
    summaryBlock = `${SUMMARY_HEADER}\n${body}`;
  }

  const systemContent = [input.systemPrompt, memoriesBlock, summaryBlock]
    .filter(Boolean)
    .join("\n\n");
  const fixedTokens = countTokens(systemContent) + TOOL_DEFS_RESERVE;

  // --- history: keep newest whole units that fit ---
  const historyBudget = EFFECTIVE_CAP - fixedTokens;
  const units = groupIntoUnits(input.rows);
  const kept: HistoryRow[][] = [];
  let historyTokens = 0;
  for (let i = units.length - 1; i >= 0; i--) {
    const unit = units[i]!;
    const unitTokens = unit.reduce((sum, r) => sum + r.tokenCount, 0);
    if (historyTokens + unitTokens > historyBudget) break;
    kept.unshift(unit);
    historyTokens += unitTokens;
  }

  let keptRows = kept.flat();
  const droppedRows = input.rows.filter(
    (row) => !keptRows.some((k) => k.id === row.id),
  );

  // Last resort: even the newest unit alone busts the budget (e.g. one giant
  // pasted message). Never send nothing — truncate its content to fit.
  if (kept.length === 0 && units.length > 0) {
    const newest = units[units.length - 1]!;
    const lastUser = newest.find((r) => r.role === "user") ?? newest[0]!;
    const budget = Math.max(historyBudget, 200);
    const content = truncateToTokens(lastUser.content, budget);
    warnings.push(
      `newest message alone exceeded history budget (${lastUser.tokenCount} tokens) and was truncated`,
    );
    keptRows = [{ ...lastUser, content, tokenCount: countTokens(content) }];
  }

  // --- build model messages; merge adjacent same-role user/assistant so the
  // history strictly alternates (§3.2) ---
  const history: ModelMessage[] = [];
  for (const row of keptRows) {
    if (row.role === "tool") {
      // Tool rows reach the model via the AI SDK's tool-message shape in
      // Phase 5; until then they are carried as-is in planning only.
      continue;
    }
    const previous = history[history.length - 1];
    if (previous && previous.role === row.role) {
      previous.content = `${previous.content as string}\n\n${row.content}`;
    } else {
      history.push({ role: row.role, content: row.content });
    }
  }

  const totalTokens =
    fixedTokens +
    history.reduce((sum, m) => sum + countTokens(m.content as string), 0);

  if (totalTokens > EFFECTIVE_CAP) {
    // Unreachable by construction; guard stays as the provable invariant.
    warnings.push(`assembled ${totalTokens} tokens exceeds cap ${EFFECTIVE_CAP}`);
  }

  return {
    system: systemContent,
    messages: history,
    droppedRows,
    totalTokens,
    warnings,
  };
}
