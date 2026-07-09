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

## Setup

```bash
cp .env.example .env   # then fill in OPENROUTER_API_KEY
bun scripts/verify-model.ts
```
