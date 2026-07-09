import { tool } from "ai";
import { evaluate } from "mathjs";
import { z } from "zod";

import { TOOL_DEFS_RESERVE } from "../contextBudget";
import { countTokens } from "../tokens";

/**
 * Every tool returns { ok: true, result } | { ok: false, error } and never
 * throws — the model must see failures as data so it can recover (§7.2).
 */

export const chatTools = {
  getCurrentDateTime: tool({
    description:
      "Use ONLY when the user's request depends on the current date or time.",
    inputSchema: z.object({}),
    execute: () => {
      const now = new Date();
      return {
        ok: true as const,
        result: {
          iso: now.toISOString(),
          human: now.toLocaleString("en-US", {
            dateStyle: "full",
            timeStyle: "short",
          }),
        },
      };
    },
  }),

  calculator: tool({
    description:
      "Use ONLY when exact arithmetic or math evaluation is needed; takes one mathjs expression like '0.15 * 2847'.",
    inputSchema: z.object({
      expression: z
        .string()
        .min(1)
        .max(200)
        .describe("A mathjs expression, e.g. '(2847 * 0.15) + 12'"),
    }),
    execute: ({ expression }) => {
      try {
        const value: unknown = evaluate(expression); // mathjs — never eval (§7.5)
        return { ok: true as const, result: String(value) };
      } catch (error) {
        return {
          ok: false as const,
          error: `could not evaluate: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  }),
};

/**
 * §6: tool definitions are measured once at startup, not guessed. The budget
 * reserves TOOL_DEFS_RESERVE; scream early if new tools outgrow it.
 */
export const MEASURED_TOOL_DEF_TOKENS = countTokens(
  JSON.stringify(
    Object.entries(chatTools).map(([name, t]) => ({
      name,
      description: t.description,
      schema: t.inputSchema,
    })),
  ),
);
if (MEASURED_TOOL_DEF_TOKENS > TOOL_DEFS_RESERVE) {
  console.warn(
    `[tools] definitions measure ${MEASURED_TOOL_DEF_TOKENS} tokens — over the ${TOOL_DEFS_RESERVE} reserve; raise TOOL_DEFS_RESERVE`,
  );
}
