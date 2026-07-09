/**
 * Context window budget (§6). The advertised window is 256K (actually served:
 * 131K — see modelCapabilities) but quality degrades far below that
 * ("context rot"), so every request fits a soft 32K working budget.
 */
export const TOTAL_BUDGET = 32_000;
export const RESERVED_OUTPUT = 4_000;

/** Reserved for tool definitions; measured properly in Phase 5. */
export const TOOL_DEFS_RESERVE = 1_500;

/** Top-k retrieved memories, truncated to fit (Phase 4 fills the data). */
export const MEMORIES_BUDGET = 1_000;

/** Rolling compaction summary block. */
export const SUMMARY_BUDGET = 1_500;

/** Compaction output cap (tokens) per §6.3. */
export const COMPACTION_MAX_TOKENS = 300;

/** Compaction runs at most once per this many new uncovered messages. */
export const COMPACTION_MIN_NEW_MESSAGES = 10;

/**
 * gpt-tokenizer only approximates Gemma's tokenizer, so the hard cap the
 * final assembly must stay under applies a 15% mismatch margin:
 * measured_total * 1.15 ≤ TOTAL_BUDGET − RESERVED_OUTPUT.
 */
export const TOKENIZER_MARGIN = 1.15;
export const EFFECTIVE_CAP = Math.floor(
  (TOTAL_BUDGET - RESERVED_OUTPUT) / TOKENIZER_MARGIN,
); // ≈ 24,347 measured tokens
