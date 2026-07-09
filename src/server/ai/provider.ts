import { createOpenRouter } from "@openrouter/ai-sdk-provider";

import { env } from "~/env";
import { MODEL_ID } from "./modelCapabilities";

const openrouter = createOpenRouter({
  apiKey: env.OPENROUTER_API_KEY,
  // We own truncation (§6): an empty transforms list stops OpenRouter from
  // silently middle-out compressing long prompts.
  extraBody: { transforms: [] },
});

export const chatModel = openrouter.chat(MODEL_ID);
