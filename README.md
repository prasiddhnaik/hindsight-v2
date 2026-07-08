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

### (a) System role — PENDING

Blocked on `OPENROUTER_API_KEY`. Re-run the script once the key is in `.env`.

### (b) Native tool_calls in practice — PENDING

Advertised support (see c) still needs a live round-trip to confirm the
`:free` endpoint returns real `tool_calls` rather than text. Blocked on the
same key.

Once (a) and (b) run, findings get hard-coded as constants in
`src/server/ai/modelCapabilities.ts` and this section gets updated.

## Setup

```bash
cp .env.example .env   # then fill in OPENROUTER_API_KEY
bun scripts/verify-model.ts
```
