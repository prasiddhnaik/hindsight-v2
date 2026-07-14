# STATUS — where things stand and what's next

Last updated: 2026-07-10. Repo: https://github.com/prasiddhnaik/hindsight-v2

## Done

- **Phases 0–5 all implemented, committed per phase, pushed.** Spec (T3 +
  OpenRouter `google/gemma-4-26b-a4b-it:free`) fully built: streaming chat,
  Neon/Prisma persistence, token-budgeted `assembleContext` (32K budget,
  15% margin, rolling compaction), long-term memory (extract every 5th user
  message, untrusted injection, /settings manager), native tool calling
  (calculator + datetime, 5-step cap, single-shot arg repair, error-as-data).
- **Offline acceptance green**: 11 unit tests (`bun test`), 100K-token
  conversation → 22.7K assembled tokens with valid alternation, persistence
  suite (refresh restore / cascade delete / no bleed), settings UI, streaming
  + natural-429 banner verified in headless Chrome.
- **Design overhaul shipped**: quiet-studio dark theme (semantic tokens,
  apricot accent, Newsreader italic empty state, open-text assistant replies,
  SVG icons, animated thinking dots, auto-scroll) + fully responsive shell
  (mobile drawer + scrim, top bar, safe-area composer, 16px mobile input).
- **Critical fix landed**: AI SDK v7 rejects system-role entries in
  `messages` — system block now flows via `streamText`'s `system` option.
  Route verified live end-to-end after the fix.

## Live verification — COMPLETE (8/8 passed, 2026-07-14)

State file: `.verify-live-state.json` (repo root, gitignored). Runner:
`bun scripts/verify-live.ts` — one attempt per check, resumable, exits 2
when the free endpoint is rate-limited, exits 1 loudly on real errors.

| Check | Status |
|---|---|
| p5-repair (malformed-args repair) | PASS 2026-07-09 |
| p4-extract (vegetarian fact stored) | PASS 2026-07-10 |
| p4-recall (new conv respects memory, via real route) | PASS 2026-07-10 |
| p4-inject (malicious memory doesn't hijack) | PASS 2026-07-14 |
| p5-chain (calculator + date, 3 steps ≤5) | PASS 2026-07-14 |
| p5-fail-tool (graceful recovery) | PASS 2026-07-14 |
| p3-compact (30-token summary holds codename) | PASS 2026-07-14 |
| p3-answer (answered "BLUEFALCON-42" from summary, full ~23K context) | PASS 2026-07-14 |

All test fixtures were auto-cleaned by the runner on completion. Full
evidence strings live in `.verify-live-state.json`; per-check details in
README's verification table.

## CURRENT FOCUS — design work

The visual foundation is in; remaining design tasks, roughly in value order:

1. ~~**Markdown rendering for assistant replies**~~ DONE 2026-07-10:
   react-markdown + remark-gfm with on-theme `.markdown` styles (headings,
   lists, code/pre, tables, blockquotes, links); verified against the stored
   recipe reply in headless Chrome. Code-block copy button still open
   (folded into item 3).
2. ~~**Replace `window.prompt`/`window.confirm`**~~ DONE 2026-07-10: inline
   rename editor (Enter saves, Esc/blur cancels, accent ring) and two-tap
   delete confirm (danger ring, auto-reverts after 4s). Verified headless:
   rename persists to DB, delete removes row, no console errors.
3. ~~**Message actions: copy**~~ DONE 2026-07-10: hover-reveal copy button
   on assistant replies with 1.5s check feedback; clipboard verified
   headless. Regenerate + per-code-block copy still open.
4. **Tool-call presentation**: richer inline chip (args + result on expand)
   instead of name-only.
5. **Sidebar polish**: relative timestamps, today/yesterday grouping,
   loading skeletons.
6. **Empty/edge states**: rate-limit banner with countdown, offline state.
7. **Light theme** using the existing semantic tokens (optional; dark is
   primary).

## Housekeeping

- Leftover test conversations (`p4-*`, `p5-*`, `synthetic-compaction`, teal)
  auto-delete when all live checks pass; safe to delete manually via UI.
- Dev server may not be running — `bun run dev` (Turbopack, port 3000).
- README has per-phase verification details; update its status table when
  the remaining live checks land.
