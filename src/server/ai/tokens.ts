import { countTokens as gptCountTokens } from "gpt-tokenizer";

/**
 * Token counts are an approximation for Gemma (gpt-tokenizer speaks GPT
 * encodings); every budget that consumes these numbers keeps a 15% safety
 * margin (§3.3). Cached on Message.tokenCount at write time so context
 * assembly never re-tokenizes history.
 */
export function countTokens(text: string): number {
  return gptCountTokens(text);
}
