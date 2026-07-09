import type { StepResult, ToolSet } from "ai";

import { db } from "~/server/db";
import { countTokens } from "./tokens";

/**
 * Persists tool calls and their results (§5): each step's calls land on an
 * assistant row's toolCalls JSON, each result as a role:"tool" row linked by
 * toolCallId. Context planning keeps these atomic with their turn unit.
 */
export async function persistToolActivity(
  conversationId: string,
  steps: StepResult<ToolSet>[],
): Promise<void> {
  for (const step of steps) {
    if (step.toolCalls.length === 0) continue;

    const callsJson = step.toolCalls.map((call) => ({
      toolCallId: call.toolCallId,
      toolName: call.toolName,
      input: call.input as object,
    }));
    await db.message.create({
      data: {
        conversationId,
        role: "assistant",
        content: step.text || `[requested ${callsJson.map((c) => c.toolName).join(", ")}]`,
        toolCalls: callsJson,
        tokenCount: countTokens(JSON.stringify(callsJson) + step.text),
      },
    });

    for (const result of step.toolResults) {
      const content = JSON.stringify(result.output);
      await db.message.create({
        data: {
          conversationId,
          role: "tool",
          content,
          toolCallId: result.toolCallId,
          tokenCount: countTokens(content),
        },
      });
    }
  }
}
