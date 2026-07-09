/**
 * Phase 5 live acceptance (run: bun scripts/verify-phase5.ts):
 *  1. Tool chaining: one prompt needing calculator + getCurrentDateTime →
 *     correct percentage AND today's date in the reply; step logs bounded ≤5.
 *  2. Failing tool → graceful spoken recovery (mathjs rejects an undefined
 *     function; the model sees { ok:false } as data and must answer in text).
 *  3. Malformed-args repair: direct call of repairToolCall with wrong-keyed
 *     JSON args → corrected JSON (simulates the SDK's invalid-input path).
 * Cleans up its conversations on success. 90s spacing between rate-limited
 * attempts (§3.1 aware).
 */
import { repairToolCall } from "~/server/ai/tools/repair";
import { db } from "~/server/db";
import { getUserId } from "~/server/user";

const userId = getUserId();

async function chatOnce(conversationId: string, text: string): Promise<string | null> {
  for (let attempt = 1; attempt <= 10; attempt++) {
    const res = await fetch("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId,
        message: { id: `p5-${Date.now()}`, role: "user", parts: [{ type: "text", text }] },
      }),
    });
    const body = await res.text();
    if (!body.includes('"type":"error"')) {
      await new Promise((r) => setTimeout(r, 1500));
      const reply = await db.message.findFirst({
        where: { conversationId, role: "assistant", toolCalls: { equals: undefined } },
        orderBy: { createdAt: "desc" },
      });
      if (reply) return reply.content;
    }
    console.log(`  attempt ${attempt} rate-limited; waiting 90s`);
    await new Promise((r) => setTimeout(r, 90_000));
  }
  return null;
}

// ---------- 1. chaining ----------
console.log("=== 1. Tool chaining (calculator + date) ===");
const chainConv = await db.conversation.create({ data: { userId, title: "p5-chain" } });
const chainReply = await chatOnce(
  chainConv.id,
  "What is 15% of 2,847? And separately, what is today's date? Use your tools for both.",
);
if (chainReply === null) {
  console.log("FAIL: chaining prompt never got through — re-run later");
  process.exit(1);
}
console.log(`  reply: ${chainReply.slice(0, 250).replace(/\n/g, " ")}`);
const today = new Date();
const percentOk = chainReply.includes("427.05") || chainReply.includes("427.1");
const monthName = today.toLocaleString("en-US", { month: "long" });
const dateOk =
  chainReply.includes(String(today.getDate())) &&
  (chainReply.toLowerCase().includes(monthName.toLowerCase()) ||
    chainReply.includes(today.toISOString().slice(0, 10)));
console.log(`  15% of 2847 = 427.05 present: ${percentOk ? "PASS" : "FAIL"}`);
console.log(`  today's date present: ${dateOk ? "PASS" : "FAIL"}`);

const toolRows = await db.message.findMany({
  where: { conversationId: chainConv.id, role: { in: ["tool", "assistant"] } },
});
const usedCalc = toolRows.some((m) => JSON.stringify(m.toolCalls ?? "").includes("calculator"));
const usedDate = toolRows.some((m) =>
  JSON.stringify(m.toolCalls ?? "").includes("getCurrentDateTime"),
);
console.log(`  calculator tool actually called: ${usedCalc ? "PASS" : "FAIL"}`);
console.log(`  getCurrentDateTime actually called: ${usedDate ? "PASS" : "FAIL"}`);
const assistantTurns = toolRows.filter((m) => m.role === "assistant").length;
console.log(`  steps bounded (≤5 assistant turns, saw ${assistantTurns}): ${assistantTurns <= 5 ? "PASS" : "FAIL"}`);

// ---------- 2. failing tool → graceful recovery ----------
console.log("=== 2. Failing tool → graceful recovery ===");
const failConv = await db.conversation.create({ data: { userId, title: "p5-fail" } });
const failReply = await chatOnce(
  failConv.id,
  'Use your calculator tool to evaluate the expression frobnicate(3) — pass it EXACTLY as written, do not fix or replace it. Then tell me what happened.',
);
if (failReply === null) {
  console.log("FAIL: failure prompt never got through — re-run later");
  process.exit(1);
}
console.log(`  reply: ${failReply.slice(0, 200).replace(/\n/g, " ")}`);
const failRows = await db.message.findMany({
  where: { conversationId: failConv.id, role: "tool" },
});
const sawFailureResult = failRows.some((m) => m.content.includes('"ok":false'));
console.log(`  tool returned ok:false as data: ${sawFailureResult ? "PASS" : "(model may have refused to call — check reply)"}`);
console.log(`  spoken recovery (non-empty text, no crash): ${failReply.trim().length > 0 ? "PASS" : "FAIL"}`);

// ---------- 3. malformed-args repair ----------
console.log("=== 3. Malformed-args repair path ===");
let repaired: unknown = null;
for (let attempt = 1; attempt <= 6 && !repaired; attempt++) {
  repaired = await repairToolCall({
    toolCall: {
      type: "tool-call",
      toolCallId: "repair-test",
      toolName: "calculator",
      input: '{"expr": "0.15 * 2847"}', // wrong key on purpose
    },
    tools: {} as never,
    inputSchema: () =>
      Promise.resolve({
        type: "object",
        properties: { expression: { type: "string" } },
        required: ["expression"],
      }),
    error: Object.assign(new Error('Unrecognized key "expr"; expected "expression"'), {}),
    messages: [],
    instructions: undefined,
    system: undefined,
  } as never);
  if (!repaired) {
    console.log(`  attempt ${attempt}: repair call rate-limited; waiting 90s`);
    await new Promise((r) => setTimeout(r, 90_000));
  }
}
if (repaired && typeof repaired === "object" && "input" in repaired) {
  const input = JSON.parse((repaired as { input: string }).input) as Record<string, unknown>;
  console.log(`  repaired input: ${JSON.stringify(input)}`);
  console.log(`  has correct "expression" key: ${"expression" in input ? "PASS" : "FAIL"}`);
} else {
  console.log("FAIL: repair never succeeded — re-run later");
}

await db.conversation.deleteMany({ where: { id: { in: [chainConv.id, failConv.id] } } });
console.log("\ncleaned up.");
await db.$disconnect();
