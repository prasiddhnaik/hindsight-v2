import { expect, test } from "bun:test";
import type { UIDataTypes, UIMessagePart, UITools } from "ai";

import { toolPartToViewModel } from "~/app/_components/tool-activity";

function part(value: unknown): UIMessagePart<UIDataTypes, UITools> {
  return value as UIMessagePart<UIDataTypes, UITools>;
}

test("normalizes a streaming dynamic tool and humanizes its name", () => {
  const input = { timezone: "Asia/Kolkata" };

  expect(
    toolPartToViewModel(
      part({
        type: "dynamic-tool",
        toolName: "currentDateTime",
        toolCallId: "call-1",
        state: "input-streaming",
        input,
      }),
    ),
  ).toEqual({
    id: "call-1",
    name: "Current date & time",
    status: "running",
    input,
  });
});

test("normalizes a static tool with available input as running", () => {
  const input = { expression: "15% of 2847" };

  expect(
    toolPartToViewModel(
      part({
        type: "tool-calculator",
        toolCallId: "call-2",
        state: "input-available",
        input,
      }),
    ),
  ).toEqual({
    id: "call-2",
    name: "Calculator",
    status: "running",
    input,
  });
});

test("preserves completed tool input and output", () => {
  const input = { expression: "1 + 1" };
  const output = { result: 2 };

  expect(
    toolPartToViewModel(
      part({
        type: "tool-calculator",
        toolCallId: "call-3",
        state: "output-available",
        input,
        output,
      }),
    ),
  ).toEqual({
    id: "call-3",
    name: "Calculator",
    status: "complete",
    input,
    output,
  });
});

test("preserves a tool failure message", () => {
  expect(
    toolPartToViewModel(
      part({
        type: "dynamic-tool",
        toolName: "weatherLookup",
        toolCallId: "call-4",
        state: "output-error",
        input: { city: "Pune" },
        errorText: "Service unavailable",
      }),
    ),
  ).toEqual({
    id: "call-4",
    name: "Weather lookup",
    status: "failed",
    input: { city: "Pune" },
    errorText: "Service unavailable",
  });
});

test("maps denied tool output to failed and preserves its reason", () => {
  expect(
    toolPartToViewModel(
      part({
        type: "tool-calculator",
        toolCallId: "call-5",
        state: "output-denied",
        input: { expression: "2 + 2" },
        approval: { id: "approval-1", approved: false, reason: "Not allowed" },
      }),
    ),
  ).toEqual({
    id: "call-5",
    name: "Calculator",
    status: "failed",
    input: { expression: "2 + 2" },
    errorText: "Not allowed",
  });
});

test("returns null for non-tool parts", () => {
  expect(
    toolPartToViewModel(part({ type: "text", text: "Hello" })),
  ).toBeNull();
});
