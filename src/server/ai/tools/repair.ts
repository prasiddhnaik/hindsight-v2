import { generateText, NoSuchToolError, type ToolCallRepairFunction } from "ai";

import { chatModel } from "../provider";
import type { chatTools } from "./index";

/**
 * §7.3: one repair attempt for malformed tool arguments — feed the validation
 * error back and ask for corrected JSON. Returning null gives up, after which
 * the SDK surfaces an error result the model sees as data.
 */
export const repairToolCall: ToolCallRepairFunction<typeof chatTools> = async ({
  toolCall,
  inputSchema,
  error,
}) => {
  if (NoSuchToolError.isInstance(error)) return null; // wrong tool name — no repair

  try {
    const schema = await inputSchema({ toolName: toolCall.toolName });
    const { text } = await generateText({
      model: chatModel,
      maxOutputTokens: 200,
      maxRetries: 0, // §3.1
      prompt: [
        `The arguments for tool "${toolCall.toolName}" were invalid.`,
        `Arguments: ${toolCall.input}`,
        `JSON schema: ${JSON.stringify(schema)}`,
        `Error: ${error.message}`,
        `Respond ONLY with the corrected JSON arguments object.`,
      ].join("\n"),
    });
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    const repaired = text.slice(start, end + 1);
    JSON.parse(repaired); // syntax gate; schema validation happens in the SDK
    console.log(
      `[tools] repaired args for ${toolCall.toolName}: ${toolCall.input} → ${repaired}`,
    );
    return { ...toolCall, input: repaired };
  } catch (repairError) {
    console.warn(`[tools] repair attempt failed:`, repairError);
    return null;
  }
};
