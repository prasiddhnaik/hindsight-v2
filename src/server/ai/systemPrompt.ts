/**
 * Base system prompt. Phase 0 verified the model honors the `system` role
 * (modelCapabilities.SUPPORTS_SYSTEM_ROLE). Phase 3 measures this with
 * gpt-tokenizer during context assembly — keep it well under ~500 tokens.
 */
export const SYSTEM_PROMPT = `You are Hindsight, a helpful general-purpose AI assistant.

Be direct, accurate, and concise. Use markdown when it aids readability.
If you don't know something or can't do it, say so plainly.`;
