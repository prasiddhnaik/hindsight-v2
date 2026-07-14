export type ChatErrorKind =
  | "rate-limit"
  | "credentials"
  | "provider"
  | "offline"
  | "unknown";

export const RATE_LIMIT_MESSAGE =
  "The free model is rate-limited right now. Please wait a minute and try again.";
const CREDENTIALS =
  "The server's OpenRouter API key was rejected. Check the OPENROUTER_API_KEY configuration.";
const PROVIDER = "The AI provider returned an error. Please try again.";

export function classifyChatError(
  message: string,
  online: boolean,
): ChatErrorKind {
  if (!online) return "offline";
  if (message === RATE_LIMIT_MESSAGE) return "rate-limit";
  if (message === CREDENTIALS) return "credentials";
  if (message === PROVIDER) return "provider";
  return "unknown";
}
