/**
 * Phase 3 live acceptance (run: bun scripts/verify-phase3.ts):
 *  1. Synthetic ~100K-token conversation → assembled request ≤ 32K budget,
 *     valid role alternation, newest message kept. (No LLM required.)
 *  2. Smaller over-budget conversation with a codename planted early →
 *     compaction produces a summary, the summary is reused, and the model
 *     answers the codename question even though it only survives in the
 *     summary. (Needs 2 successful LLM calls; retries spaced 60s.)
 * Synthetic conversations are deleted afterwards.
 */
import { assembleContext } from "~/server/ai/assembleContext";
import { countTokens } from "~/server/ai/tokens";
import { TOTAL_BUDGET } from "~/server/ai/contextBudget";
import { db } from "~/server/db";
import { getUserId } from "~/server/user";

const CODENAME = "BLUEFALCON-42";

async function seedConversation(
  title: string,
  exchanges: number,
  tokensPerMessage: number,
  plantCodename: boolean,
): Promise<string> {
  const conv = await db.conversation.create({
    data: { userId: getUserId(), title },
  });
  const filler = () => "The user and assistant discussed project logistics. ".repeat(
    Math.ceil(tokensPerMessage / 9),
  );
  const base = Date.now() - exchanges * 2 * 60_000;
  const rows: {
    conversationId: string;
    role: string;
    content: string;
    tokenCount: number;
    createdAt: Date;
  }[] = [];
  for (let i = 0; i < exchanges; i++) {
    const userContent =
      plantCodename && i === 1
        ? `Important: my secret project codename is ${CODENAME}. Please remember it exactly.`
        : `Question ${i}: ${filler()}`;
    const assistantContent =
      plantCodename && i === 1
        ? `Understood — your project codename is ${CODENAME}. I will remember it.`
        : `Answer ${i}: ${filler()}`;
    rows.push(
      {
        conversationId: conv.id,
        role: "user",
        content: userContent,
        tokenCount: countTokens(userContent),
        createdAt: new Date(base + i * 2 * 60_000),
      },
      {
        conversationId: conv.id,
        role: "assistant",
        content: assistantContent,
        tokenCount: countTokens(assistantContent),
        createdAt: new Date(base + (i * 2 + 1) * 60_000),
      },
    );
  }
  await db.message.createMany({ data: rows });
  const total = rows.reduce((s, r) => s + r.tokenCount, 0);
  console.log(`seeded "${title}": ${rows.length} messages, ~${total} tokens`);
  return conv.id;
}

function checkPlan(messages: Awaited<ReturnType<typeof assembleContext>>) {
  const total = messages.reduce(
    (sum, m) => sum + countTokens(m.content as string),
    0,
  );
  let alternationOk = messages[0]!.role === "system";
  for (let i = 2; i < messages.length; i++) {
    if (messages[i]!.role === messages[i - 1]!.role) alternationOk = false;
  }
  if (messages[1] && messages[1].role !== "user") alternationOk = false;
  return { total, alternationOk };
}

const partFilter = process.argv[2]; // e.g. "part2" to skip part 1

// ---------- Part 1: 100K-token conversation, budget + alternation ----------
if (partFilter !== "part2") {
console.log("\n=== Part 1: 100K-token budget check (LLM-free) ===");
const bigId = await seedConversation("synthetic-100k", 115, 450, false);
const bigPlan = await assembleContext(bigId, getUserId()); // compaction may 429; that's fine
const big = checkPlan(bigPlan);
console.log(
  `assembled: ${bigPlan.length} messages, ${big.total} measured tokens`,
);
console.log(`  ≤ ${TOTAL_BUDGET} budget: ${big.total <= TOTAL_BUDGET ? "PASS" : "FAIL"}`);
console.log(`  role alternation valid: ${big.alternationOk ? "PASS" : "FAIL"}`);
const newestKept = (bigPlan[bigPlan.length - 1]!.content as string).includes(
  "Question 114",
) || (bigPlan[bigPlan.length - 1]!.content as string).includes("Answer 114");
console.log(`  newest message kept: ${newestKept ? "PASS" : "FAIL"}`);
await db.conversation.delete({ where: { id: bigId } });
console.log("  cleaned up.");
}

// ---------- Part 2: compaction, summary reuse, answer-from-summary ----------
console.log("\n=== Part 2: compaction + answer-from-summary (needs LLM) ===");
// Reuse a leftover run's conversation (with its summary) if present.
const existing = await db.conversation.findFirst({
  where: { userId: getUserId(), title: "synthetic-compaction" },
});
const smallId =
  existing?.id ?? (await seedConversation("synthetic-compaction", 40, 420, true));
if (existing) console.log(`reusing existing synthetic conversation ${smallId}`);

let summary: string | null = null;
for (let attempt = 1; attempt <= 10; attempt++) {
  await assembleContext(smallId, getUserId());
  const conv = await db.conversation.findUnique({
    where: { id: smallId },
    select: { summary: true, summaryUpToMessageId: true },
  });
  summary = conv?.summary ?? null;
  if (summary) {
    console.log(`compaction succeeded on attempt ${attempt}`);
    console.log(`  summary (${countTokens(summary)} tokens): ${summary.slice(0, 160)}…`);
    break;
  }
  console.log(`  attempt ${attempt}: compaction rate-limited; waiting 60s`);
  await new Promise((r) => setTimeout(r, 60_000));
}
if (!summary) {
  console.log("FAIL: compaction never succeeded (rate limits) — re-run later");
  process.exit(1);
}
console.log(`  summary contains codename: ${summary.includes(CODENAME) ? "PASS" : "FAIL"}`);

// Summary must be REUSED on the next assembly, and the codename must not
// appear in any verbatim (non-system) message.
const plan2 = await assembleContext(smallId, getUserId());
const systemContent = plan2[0]!.content as string;
console.log(
  `  summary block reused in system message: ${systemContent.includes("Summary of earlier parts") ? "PASS" : "FAIL"}`,
);
const inVerbatim = plan2
  .slice(1)
  .some((m) => (m.content as string).includes(CODENAME));
console.log(
  `  codename absent from verbatim window (lives only in summary): ${!inVerbatim ? "PASS" : "FAIL"}`,
);

// Ask the question through the real chat route.
let answered = false;
for (let attempt = 1; attempt <= 10 && !answered; attempt++) {
  const res = await fetch("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      conversationId: smallId,
      message: {
        id: `p3-${attempt}`,
        role: "user",
        parts: [
          {
            type: "text",
            text: "What is my secret project codename? Reply with just the codename.",
          },
        ],
      },
    }),
  });
  const body = await res.text();
  if (body.includes("text-delta")) {
    const reply = await db.message.findFirst({
      where: { conversationId: smallId, role: "assistant" },
      orderBy: { createdAt: "desc" },
    });
    console.log(`model reply: ${reply?.content.slice(0, 120)}`);
    console.log(
      `  answered from summary: ${reply?.content.includes("BLUEFALCON") ? "PASS" : "FAIL"}`,
    );
    answered = true;
  } else {
    console.log(`  attempt ${attempt}: question rate-limited; waiting 90s`);
    await new Promise((r) => setTimeout(r, 90_000));
  }
}
if (answered) {
  await db.conversation.delete({ where: { id: smallId } });
  console.log("cleaned up.\n");
} else {
  console.log(
    "FAIL: question never got through rate limits — conversation kept; re-run with: bun scripts/verify-phase3.ts part2",
  );
}
await db.$disconnect();
