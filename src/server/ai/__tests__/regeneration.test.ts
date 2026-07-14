import { describe, expect, test } from "bun:test";

import { rowsForGeneration } from "../regeneration";
import type { HistoryRow } from "../planContext";

function row(id: string, role: HistoryRow["role"]): HistoryRow {
  return { id, role, content: id, tokenCount: 1 };
}

describe("rowsForGeneration", () => {
  test("returns every row unchanged for a normal send", () => {
    const rows = [row("u1", "user"), row("a1", "assistant")];

    expect(rowsForGeneration(rows, "send")).toBe(rows);
  });

  test("removes assistant and tool rows after the latest user", () => {
    const rows = [
      row("u1", "user"),
      row("a1", "assistant"),
      row("u2", "user"),
      row("call2", "assistant"),
      row("result2", "tool"),
      row("a2", "assistant"),
    ];

    expect(rowsForGeneration(rows, "regenerate").map(({ id }) => id)).toEqual([
      "u1",
      "a1",
      "u2",
    ]);
  });

  test("preserves the latest user row", () => {
    const rows = [row("u1", "user"), row("a1", "assistant"), row("u2", "user")];

    expect(rowsForGeneration(rows, "regenerate").at(-1)?.id).toBe("u2");
  });

  test("fails clearly when regeneration has no user row", () => {
    const rows = [row("a1", "assistant"), row("result1", "tool")];

    expect(() => rowsForGeneration(rows, "regenerate")).toThrow(
      "Cannot regenerate without a user message",
    );
  });
});
