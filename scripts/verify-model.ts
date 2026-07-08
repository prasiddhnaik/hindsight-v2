/**
 * Phase 0 de-risk script.
 *
 * Answers three questions about `google/gemma-4-26b-a4b-it:free` on OpenRouter:
 *   a) Does it accept a `system` role message?
 *   b) Does the :free endpoint return real native `tool_calls`?
 *   c) What do the model's advertised `supported_parameters` / context limits say?
 *
 * Run: bun scripts/verify-model.ts   (needs OPENROUTER_API_KEY in env or .env for a+b)
 *
 * Findings get hard-coded into src/server/ai/modelCapabilities.ts.
 */

const MODEL = "google/gemma-4-26b-a4b-it:free";
const BASE = "https://openrouter.ai/api/v1";
const API_KEY = process.env.OPENROUTER_API_KEY;

interface ChatResult {
  status: number;
  body: unknown;
}

async function chat(payload: Record<string, unknown>): Promise<ChatResult> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 256, ...payload }),
  });
  const body: unknown = await res.json().catch(() => null);
  return { status: res.status, body };
}

function extractMessage(body: unknown): {
  content?: string;
  toolCalls?: unknown[];
  finishReason?: string;
  error?: string;
} {
  const b = body as {
    choices?: {
      message?: { content?: string; tool_calls?: unknown[] };
      finish_reason?: string;
    }[];
    error?: { message?: string };
  } | null;
  if (b?.error) return { error: b.error.message ?? JSON.stringify(b.error) };
  const choice = b?.choices?.[0];
  return {
    content: choice?.message?.content ?? undefined,
    toolCalls: choice?.message?.tool_calls,
    finishReason: choice?.finish_reason,
  };
}

async function testSystemRole(): Promise<string> {
  const { status, body } = await chat({
    messages: [
      {
        role: "system",
        content:
          "You are a pirate. Answer every message in exaggerated pirate speak.",
      },
      { role: "user", content: "Greet me in one short sentence." },
    ],
  });
  const msg = extractMessage(body);
  if (status !== 200 || msg.error) {
    return `REJECTED (HTTP ${status}): ${msg.error ?? JSON.stringify(body)}`;
  }
  const looksPirate = /\b(ahoy|arr|matey|ye\b|aye)/i.test(msg.content ?? "");
  return `ACCEPTED (HTTP 200). System prompt ${
    looksPirate ? "clearly followed" : "accepted but influence unclear"
  }. Reply: ${JSON.stringify(msg.content)}`;
}

async function testNativeTools(): Promise<string> {
  const { status, body } = await chat({
    messages: [
      {
        role: "user",
        content:
          "What is the exact current time? You must call the get_time tool to find out.",
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "get_time",
          description: "Returns the current date and time.",
          parameters: { type: "object", properties: {}, required: [] },
        },
      },
    ],
  });
  const msg = extractMessage(body);
  if (status !== 200 || msg.error) {
    return `ERROR (HTTP ${status}): ${msg.error ?? JSON.stringify(body)}`;
  }
  if (msg.toolCalls && msg.toolCalls.length > 0) {
    return `NATIVE TOOL_CALLS RETURNED (finish_reason=${msg.finishReason}): ${JSON.stringify(msg.toolCalls)}`;
  }
  return `NO tool_calls — plain text came back (finish_reason=${msg.finishReason}): ${JSON.stringify(msg.content)}`;
}

async function testModelMetadata(): Promise<string> {
  const res = await fetch(`${BASE}/models`);
  const data = (await res.json()) as {
    data: {
      id: string;
      context_length: number;
      supported_parameters: string[];
      top_provider?: { context_length?: number; max_completion_tokens?: number };
    }[];
  };
  const model = data.data.find((m) => m.id === MODEL);
  if (!model) return `MODEL NOT FOUND in /models listing`;
  return [
    `context_length (advertised): ${model.context_length}`,
    `top_provider.context_length (actual): ${model.top_provider?.context_length}`,
    `top_provider.max_completion_tokens: ${model.top_provider?.max_completion_tokens}`,
    `supported_parameters: ${model.supported_parameters.join(", ")}`,
  ].join("\n   ");
}

const metadata = await testModelMetadata();
console.log(`\n(c) Model metadata for ${MODEL}:\n   ${metadata}\n`);

if (!API_KEY) {
  console.log(
    "(a)+(b) SKIPPED: OPENROUTER_API_KEY is not set. Add it to .env and re-run.",
  );
  process.exit(1);
}

console.log(`(a) System role: ${await testSystemRole()}\n`);
console.log(`(b) Native tools: ${await testNativeTools()}\n`);
