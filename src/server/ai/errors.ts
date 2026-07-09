import { APICallError } from "ai";

/**
 * OpenRouter puts the useful upstream detail in `error.metadata.raw`
 * (verified in Phase 0), so pull it out for server logs.
 */
function upstreamDetail(error: APICallError): string {
  try {
    const body = JSON.parse(error.responseBody ?? "") as {
      error?: { metadata?: { raw?: string; provider_name?: string } };
    };
    const meta = body.error?.metadata;
    if (!meta?.raw) return "";
    return ` [${meta.provider_name ?? "upstream"}: ${meta.raw}]`;
  } catch {
    return "";
  }
}

/**
 * Maps a streaming/model error to the message shown in the chat UI.
 * 429s are never retried (§3.1) — the user is told to wait instead.
 */
export function friendlyErrorMessage(error: unknown): string {
  if (APICallError.isInstance(error)) {
    console.error(
      `[chat] OpenRouter error ${error.statusCode}: ${error.message}${upstreamDetail(error)}`,
    );
    if (error.statusCode === 429) {
      return "The free model is rate-limited right now. Please wait a minute and try again.";
    }
    if (error.statusCode === 401 || error.statusCode === 403) {
      return "The server's OpenRouter API key was rejected. Check the OPENROUTER_API_KEY configuration.";
    }
    return "The AI provider returned an error. Please try again.";
  }
  console.error("[chat] unexpected error:", error);
  return "Something went wrong while generating a response. Please try again.";
}
