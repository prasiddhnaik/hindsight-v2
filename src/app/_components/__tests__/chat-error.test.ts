import { describe, expect, test } from "bun:test";

import { classifyChatError } from "~/app/_components/chat-error";

const RATE_LIMIT =
  "The free model is rate-limited right now. Please wait a minute and try again.";
const CREDENTIALS =
  "The server's OpenRouter API key was rejected. Check the OPENROUTER_API_KEY configuration.";
const PROVIDER = "The AI provider returned an error. Please try again.";
const UNKNOWN =
  "Something went wrong while generating a response. Please try again.";

describe("classifyChatError", () => {
  test("classifies each exact friendly server message", () => {
    expect(classifyChatError(RATE_LIMIT, true)).toBe("rate-limit");
    expect(classifyChatError(CREDENTIALS, true)).toBe("credentials");
    expect(classifyChatError(PROVIDER, true)).toBe("provider");
    expect(classifyChatError(UNKNOWN, true)).toBe("unknown");
  });

  test("does not loosely classify altered messages", () => {
    expect(classifyChatError(`${RATE_LIMIT} Later.`, true)).toBe("unknown");
  });

  test("browser offline takes precedence over the message", () => {
    expect(classifyChatError(CREDENTIALS, false)).toBe("offline");
  });
});
