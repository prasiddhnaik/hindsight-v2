import { beforeEach, describe, expect, mock, test } from "bun:test";

interface CreateData {
  role?: string;
  createdAt?: Date;
  toolCalls?: unknown;
  toolCallId?: string | null;
  [key: string]: unknown;
}

const created: CreateData[] = [];
const create = mock(async ({ data }: { data: CreateData }) => {
  created.push(data);
  return data;
});
const findMany = mock(async (_query: unknown) => []);
const update = mock(async () => ({}));
const fakeDb = {
  message: { create, findMany },
  conversation: { update },
};

mock.module("~/server/db", () => ({ db: fakeDb }));

const [{ loadUIMessages, persistAssistantMessage }, { persistToolActivity }] =
  await Promise.all([import("../chatStore"), import("../toolStore")]);
const { monotonicTimestampSupplier } = await import("../regeneration");

beforeEach(() => {
  created.length = 0;
  create.mockClear();
  findMany.mockClear();
  update.mockClear();
});

describe("regeneration storage chronology", () => {
  test("writes call, result, and final text at increasing timestamps", async () => {
    const nextTimestamp = monotonicTimestampSupplier(
      new Date("2026-07-14T10:00:00.000Z"),
    );
    const steps = [
      {
        text: "",
        toolCalls: [
          { toolCallId: "call-1", toolName: "search", input: { query: "moon" } },
        ],
        toolResults: [
          { toolCallId: "call-1", toolName: "search", output: { found: true } },
        ],
      },
    ] as unknown as Parameters<typeof persistToolActivity>[1];

    await persistToolActivity(
      "conversation-1",
      steps,
      fakeDb as unknown as Parameters<typeof persistToolActivity>[2],
      nextTimestamp,
    );
    await persistAssistantMessage(
      "conversation-1",
      "Final answer",
      fakeDb as unknown as Parameters<typeof persistAssistantMessage>[2],
      nextTimestamp,
    );

    expect(created.map(({ role }) => role)).toEqual([
      "assistant",
      "tool",
      "assistant",
    ]);
    expect(created.map(({ createdAt }) => createdAt?.toISOString())).toEqual([
      "2026-07-14T10:00:00.000Z",
      "2026-07-14T10:00:00.001Z",
      "2026-07-14T10:00:00.002Z",
    ]);
    expect(created[0]?.toolCalls).toBeArray();
    expect(created[1]?.toolCallId).toBe("call-1");
    expect(created[2]?.toolCalls).toBeUndefined();
  });

  test("loads equal-timestamp rows with an id fallback", async () => {
    await loadUIMessages("conversation-1");

    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  });
});
