/**
 * Phase 0 verified capabilities of `google/gemma-4-26b-a4b-it:free`.
 * Verified live on 2026-07-08 via scripts/verify-model.ts — see README.
 * Re-run that script before changing anything here.
 */

export const MODEL_ID = "google/gemma-4-26b-a4b-it:free";

/**
 * Test (a): system role returned HTTP 200 and the reply followed the system
 * prompt. No fold-into-first-user-message fallback needed.
 */
export const SUPPORTS_SYSTEM_ROLE = true;

/**
 * Test (b): the :free endpoint returned real `tool_calls` with
 * `finish_reason: "tool_calls"`. Native AI SDK tool loop works; no ReAct
 * fallback needed.
 */
export const SUPPORTS_NATIVE_TOOLS = true;

/**
 * Test (c): advertised context is 262,144 but the endpoint actually serves
 * 131,072 with max 32,768 completion tokens. Irrelevant to budgeting either
 * way — we cap ourselves far lower (§3.3): 32K soft working budget.
 */
export const ADVERTISED_CONTEXT_LENGTH = 262_144;
export const ACTUAL_CONTEXT_LENGTH = 131_072;
export const MAX_COMPLETION_TOKENS = 32_768;

/**
 * Operational finding: the free endpoint sheds load in bursts — back-to-back
 * requests 429 ("temporarily rate-limited upstream") even at low volume,
 * while single spaced requests succeed. Surface 429s to the user as a
 * friendly "try again in a minute" and NEVER auto-retry (§3.1). The useful
 * upstream detail lives in `error.metadata.raw`, not `error.message`.
 */
export const FREE_TIER_REQUESTS_PER_MINUTE = 20;
export const FREE_TIER_REQUESTS_PER_DAY = 50;
