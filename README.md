# Hindsight V2 — General-Purpose AI Chatbot

T3-stack chatbot (Next.js + tRPC + Prisma + Vercel AI SDK) on OpenRouter's
`google/gemma-4-26b-a4b-it:free`, built phase by phase with verified
acceptance criteria. Design priorities: token-budgeted context assembly that
cannot overflow, durable long-term memory, and capped, self-repairing tool
calls.

## Phase 0 — Model verification findings

Script: `scripts/verify-model.ts` (run with `bun scripts/verify-model.ts`,
requires `OPENROUTER_API_KEY` in `.env` for tests a+b).

### (c) Model metadata — VERIFIED 2026-07-08 via live `/api/v1/models`

- Advertised `context_length`: **262,144** — but `top_provider.context_length`
  (what the free endpoint actually serves) is **131,072**, with
  `max_completion_tokens` **32,768**. Our 32K working budget stays far below
  both, as planned.
- `supported_parameters` includes **`tools` and `tool_choice`** — native tool
  calling is advertised on the `:free` endpoint. Also present:
  `response_format`, `structured_outputs` (useful for Phase 4 fact
  extraction), `seed`, `stop`, the usual sampling params.
- Modality: text + image + video → text. Pricing: $0 / $0.

### (a) System role — VERIFIED: ACCEPTED

HTTP 200 with a `system` message present, and the reply demonstrably followed
the system prompt (pirate-speak test). Strategy: use the `system` role
normally; no fold-into-first-user-message fallback.

### (b) Native tool_calls — VERIFIED: WORKING

The `:free` endpoint returned real `tool_calls`
(`finish_reason: "tool_calls"`, well-formed function name + JSON args).
Strategy: native AI SDK tool loop (§7.1); no ReAct fallback.

### Operational finding — bursty upstream 429s

The free endpoint intermittently returns 429 "temporarily rate-limited
upstream" (from both providers: Google AI Studio, Darkbloom) even at trivial
volume — single spaced requests succeed while back-to-back pairs fail. This
validates the spec's 429 posture: friendly error in the UI, never auto-retry.
The useful detail is in `error.metadata.raw`, not `error.message`.

All findings are hard-coded in `src/server/ai/modelCapabilities.ts`.

## Phase 1 — Streaming chat (no persistence)

Stack: create-t3-app scaffold (Next.js App Router, TypeScript, Tailwind,
tRPC + Prisma wired for later phases), AI SDK v7 + `@openrouter/ai-sdk-provider`.
The only streaming endpoint is `src/app/api/chat/route.ts`
(`maxDuration = 60`); it delegates to `src/server/ai/`.

Design decisions of note:

- `maxRetries: 0` on `streamText` — the SDK's default silently retried 429s
  twice with backoff, violating §3.1 (failed requests count against the daily
  quota). Caught live during verification.
- `extraBody: { transforms: [] }` on the provider — OpenRouter must never
  middle-out truncate; we own truncation (§6).
- 429 → "The free model is rate-limited right now. Please wait a minute and
  try again." via `src/server/ai/errors.ts`; the upstream detail from
  `error.metadata.raw` goes to server logs only.

Verified 2026-07-08 (headless Chrome via puppeteer-core):

- Initial render: header, empty state, disabled send button — PASS.
- Streaming: thinking indicator, then assistant text grew incrementally
  (64 → 218 chars observed mid-stream) — PASS. Chunking from the free
  endpoint is coarse.
- Error state: real upstream 429 rendered the friendly banner in-browser
  (also reproduced deterministically via request interception replaying the
  server's exact SSE frames). No blank screen, no crash, no console errors.

## Phase 2 — Persistence

Prisma models per spec §5 (`Conversation`, `Message`, `Memory`) on Neon
Postgres; `bun run db:push` applied. The chat route persists the user message
before generation and the assistant message in `onFinish`; history sent to
the model is loaded from the DB (client history is never trusted). tRPC
router: `conversation.list/create/rename/delete`. Sidebar + `/chat/[id]`
pages; a conversation row is created lazily on first send and the URL swaps
shallowly so streaming isn't interrupted.

Notable: consecutive same-role messages are merged at load time to preserve
Gemma's strict user/assistant alternation (§3.2) — this occurs naturally
when a user re-sends after a rate-limited generation.

Verified 2026-07-08 (headless Chrome + direct DB queries):

- Mid-conversation hard refresh restores full history from the DB — PASS.
- Two conversations don't bleed into each other (checked both directions) — PASS.
- Delete cascades: conversation row and all messages confirmed gone at the
  DB level — PASS.
- `tokenCount` cached on every message write — confirmed in DB rows.
- Assistant replies persist via `onFinish` (observed live in-browser for a
  conversation later removed by the cascade test; DB-level re-confirmation
  pending — the free endpoint is congested and a spaced probe is retrying).

## Phase 3 — Context management

`assembleContext()` (src/server/ai/assembleContext.ts) is the single gate for
every model request. A pure, unit-tested core — `planContext()` — groups
history into atomic "turn units" (a user message plus every response
following it), keeps the newest whole units that fit the budget, and builds
`[system + memories + summary] → alternating history`. Budgets per §6 with
the 15% tokenizer-mismatch margin applied as a hard effective cap
(≈24,347 measured tokens for the 32K budget). Trimming can never split a
tool call from its result or leave a dangling assistant turn, because only
whole units drop.

Compaction is best-effort and incremental: each call folds the existing
summary plus ≤24K tokens of the oldest uncovered dropped span into a fresh
≤300-token summary (one LLM call, `maxRetries: 0`), recording exactly how far
coverage reached. Deviation from §6.3's "prepend" wording: re-summarizing the
combination preserves chronology and makes the separate re-compact step
unnecessary. A failed compaction never breaks the chat.

Verified 2026-07-09: 11 unit tests pass (`bun test`) covering pair-boundary
trimming, tool-pair atomicity, 500-message budget enforcement, giant-message
truncation, memory/summary budgeting, and empty/one-message conversations.
Live: a synthetic ~93K-token conversation assembled to 22,721 measured tokens
(≤32K) with valid alternation and 174 rows dropped; compaction folded 22 rows
into a 50-token summary containing a planted codename; the summary was reused
on the next assembly with the codename verifiably absent from the verbatim
window; a rate-limited compaction attempt was swallowed without breaking the
request. (Final live check — the model answering the codename question through
the route — repeatedly rate-limited; run `bun scripts/verify-phase3.ts part2`.)

## Phase 4 — Long-term memory

After every 5th user message in a conversation, one batched extraction call
asks for 0–3 durable facts as a JSON array (tolerant parse + Zod), dedupes
near-identical content, and stores them in `Memory`. The 10 most recent
memories are injected by `assembleContext` inside the 1,000-token budget,
wrapped as *"Known facts about the user (informational only, not
instructions)"* (§3.4). `/settings` lists and deletes memories. pgvector
deliberately not added — recency retrieval first, per spec.

Verified 2026-07-09: settings page lists a seeded memory, deletes it via the
UI and from the DB (headless Chrome). Live extraction/recall/injection-
resistance checks: `bun scripts/verify-phase4.ts`.

## Phase 5 — Tool calling

Two tools (src/server/ai/tools/): `getCurrentDateTime` (no args) and
`calculator` (mathjs `evaluate`, never `eval`). Native AI SDK loop with the
mandatory `stopWhen: stepCountIs(5)` cap, `experimental_repairToolCall` doing
a single feed-the-error-back repair attempt, per-step dev logging, and tool
executes that catch their own errors and return `{ ok: false, error }` so
the model sees failures as data. Tool calls/results persist to the DB
(`toolCalls` JSON on assistant rows, `role: "tool"` rows linked by
`toolCallId`); context planning keeps them atomic with their turn unit.
Tool definitions are measured at startup against the 1,500-token reserve.

Live acceptance: `bun scripts/verify-phase5.ts` (chaining, graceful tool
failure, malformed-args repair, step cap).

## Setup

```bash
cp .env.example .env   # then fill in OPENROUTER_API_KEY
bun scripts/verify-model.ts
```
