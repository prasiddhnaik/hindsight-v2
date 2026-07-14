import { describe, expect, test } from "bun:test";

import {
  storedRowsToUIMessages,
  type StoredMessageRow,
} from "../uiMessages";

function row(
  id: string,
  role: string,
  content: string,
  overrides: Partial<StoredMessageRow> = {},
): StoredMessageRow {
  return {
    id,
    role,
    content,
    toolCalls: null,
    toolCallId: null,
    createdAt: new Date("2026-07-14T00:00:00.000Z"),
    ...overrides,
  };
}

function call(toolCallId: string, toolName: string, input: unknown) {
  return { toolCallId, toolName, input };
}

describe("storedRowsToUIMessages", () => {
  test("converts plain user and assistant rows to text messages", () => {
    const messages = storedRowsToUIMessages([
      row("u1", "user", "Hello"),
      row("a1", "assistant", "Hi there"),
    ]);

    expect(messages).toEqual([
      { id: "u1", role: "user", parts: [{ type: "text", text: "Hello" }] },
      {
        id: "a1",
        role: "assistant",
        parts: [{ type: "text", text: "Hi there" }],
      },
    ]);
  });

  test("matches a stored tool result and parses its JSON output", () => {
    const messages = storedRowsToUIMessages([
      row("a1", "assistant", "Found it", {
        toolCalls: [call("call-1", "search", { query: "moon" })],
      }),
      row("t1", "tool", '{"items":["Luna"]}', { toolCallId: "call-1" }),
    ]);

    expect(messages[0]?.parts).toEqual([
      {
        type: "dynamic-tool",
        toolName: "search",
        toolCallId: "call-1",
        state: "output-available",
        input: { query: "moon" },
        output: { items: ["Luna"] },
      },
      { type: "text", text: "Found it" },
    ]);
  });

  test("keeps a call input-available when its result is missing", () => {
    const messages = storedRowsToUIMessages([
      row("a1", "assistant", "", {
        toolCalls: [call("call-1", "search", { query: "moon" })],
      }),
    ]);

    expect(messages[0]?.parts).toEqual([
      {
        type: "dynamic-tool",
        toolName: "search",
        toolCallId: "call-1",
        state: "input-available",
        input: { query: "moon" },
      },
    ]);
  });

  test("preserves multiple persisted calls and results in call order", () => {
    const messages = storedRowsToUIMessages([
      row("a1", "assistant", "", {
        toolCalls: [
          call("call-2", "weather", { city: "Pune" }),
          call("call-1", "search", { query: "moon" }),
        ],
      }),
      row("t1", "tool", '"first"', { toolCallId: "call-1" }),
      row("t2", "tool", '"second"', { toolCallId: "call-2" }),
    ]);

    expect(messages[0]?.parts.map((part) =>
      part.type === "dynamic-tool" ? [part.toolCallId, part.output] : part.type,
    )).toEqual([
      ["call-2", "second"],
      ["call-1", "first"],
    ]);
  });

  test("uses raw tool output when it is not JSON", () => {
    const messages = storedRowsToUIMessages([
      row("a1", "assistant", "", {
        toolCalls: [call("call-1", "lookup", {})],
      }),
      row("t1", "tool", "not-json", { toolCallId: "call-1" }),
    ]);

    const part = messages[0]?.parts[0];
    expect(part?.type).toBe("dynamic-tool");
    if (part?.type === "dynamic-tool") expect(part.output).toBe("not-json");
  });

  test("hides the synthetic tool-request fallback text", () => {
    const messages = storedRowsToUIMessages([
      row("a1", "assistant", "[requested search, weather]", {
        toolCalls: [
          call("call-1", "search", {}),
          call("call-2", "weather", {}),
        ],
      }),
    ]);

    expect(messages[0]?.parts.every((part) => part.type === "dynamic-tool")).toBe(
      true,
    );
  });

  test("degrades malformed toolCalls safely to assistant text", () => {
    const messages = storedRowsToUIMessages([
      row("a1", "assistant", "Still useful", {
        toolCalls: [{ toolCallId: "call-1", input: {} }],
      }),
    ]);

    expect(messages).toEqual([
      {
        id: "a1",
        role: "assistant",
        parts: [{ type: "text", text: "Still useful" }],
      },
    ]);
  });

  test("never emits tool rows as standalone UI messages", () => {
    const messages = storedRowsToUIMessages([
      row("orphan", "tool", "result", { toolCallId: "unknown" }),
      row("u1", "user", "Hello"),
    ]);

    expect(messages.map(({ id }) => id)).toEqual(["u1"]);
  });
});
