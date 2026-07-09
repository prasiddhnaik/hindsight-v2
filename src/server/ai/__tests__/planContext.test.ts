import { describe, expect, test } from "bun:test";

import {
  EFFECTIVE_CAP,
  TOOL_DEFS_RESERVE,
} from "../contextBudget";
import {
  groupIntoUnits,
  planContext,
  type HistoryRow,
} from "../planContext";
import { countTokens } from "../tokens";

let nextId = 0;
function row(
  role: HistoryRow["role"],
  content: string,
  overrides: Partial<HistoryRow> = {},
): HistoryRow {
  return {
    id: `m${nextId++}`,
    role,
    content,
    tokenCount: countTokens(content),
    ...overrides,
  };
}

/** A user/assistant exchange of roughly `tokensEach` tokens per message. */
function exchange(index: number, tokensEach: number): HistoryRow[] {
  const filler = "lorem ".repeat(tokensEach);
  return [
    row("user", `question ${index}: ${filler}`),
    row("assistant", `answer ${index}: ${filler}`),
  ];
}

const SYSTEM = "You are a helpful test assistant.";

function plan(rows: HistoryRow[], extra?: Partial<Parameters<typeof planContext>[0]>) {
  return planContext({
    systemPrompt: SYSTEM,
    memories: [],
    summary: null,
    rows,
    ...extra,
  });
}

describe("groupIntoUnits", () => {
  test("groups a user turn with its responses", () => {
    const rows = [
      row("user", "q1"),
      row("assistant", "a1"),
      row("user", "q2"),
      row("assistant", "calling tool"),
      row("tool", "tool result"),
      row("assistant", "a2"),
    ];
    const units = groupIntoUnits(rows);
    expect(units.length).toBe(2);
    expect(units[0]!.map((r) => r.role)).toEqual(["user", "assistant"]);
    expect(units[1]!.map((r) => r.role)).toEqual([
      "user",
      "assistant",
      "tool",
      "assistant",
    ]);
  });

  test("leading non-user rows form their own unit", () => {
    const rows = [row("assistant", "orphan"), row("user", "q1")];
    const units = groupIntoUnits(rows);
    expect(units.length).toBe(2);
  });
});

describe("planContext — basics", () => {
  test("empty conversation → just the system message", () => {
    const result = plan([]);
    expect(result.messages.length).toBe(1);
    expect(result.messages[0]!.role).toBe("system");
    expect(result.droppedRows.length).toBe(0);
  });

  test("one-message conversation", () => {
    const result = plan([row("user", "hello there")]);
    expect(result.messages.map((m) => m.role)).toEqual(["system", "user"]);
    expect(result.droppedRows.length).toBe(0);
  });

  test("adjacent same-role messages are merged (role alternation)", () => {
    const result = plan([
      row("user", "first try"),
      row("user", "second try"),
      row("user", "third try"),
    ]);
    const roles = result.messages.map((m) => m.role);
    expect(roles).toEqual(["system", "user"]);
    expect(result.messages[1]!.content).toContain("first try");
    expect(result.messages[1]!.content).toContain("third try");
  });
});

describe("planContext — pair-boundary trimming", () => {
  test("drops whole oldest exchanges; never leaves a dangling assistant", () => {
    // ~300 tokens per message → ~600/exchange; 60 exchanges ≈ 36K tokens.
    const rows = Array.from({ length: 60 }, (_, i) => exchange(i, 300)).flat();
    const result = plan(rows);

    expect(result.droppedRows.length).toBeGreaterThan(0);
    // Dropped rows are the oldest and come in whole pairs.
    expect(result.droppedRows[0]!.id).toBe(rows[0]!.id);
    expect(result.droppedRows.length % 2).toBe(0);

    // First history message after system is a user message.
    expect(result.messages[1]!.role).toBe("user");
    // Strict alternation throughout.
    for (let i = 2; i < result.messages.length; i++) {
      expect(result.messages[i]!.role).not.toBe(result.messages[i - 1]!.role);
    }
    // Newest message survived.
    const last = result.messages[result.messages.length - 1]!;
    expect(last.content).toContain("answer 59");
  });

  test("tool-call/result pairs are never split from their unit", () => {
    const filler = "lorem ".repeat(400);
    const rows: HistoryRow[] = [];
    for (let i = 0; i < 40; i++) {
      rows.push(row("user", `q${i} ${filler}`));
      rows.push(row("assistant", `calling tool for ${i}`));
      rows.push(row("tool", `tool result ${i}`));
      rows.push(row("assistant", `a${i} ${filler}`));
    }
    const result = plan(rows);
    expect(result.droppedRows.length).toBeGreaterThan(0);

    // Every dropped tool result's sibling call is dropped too, and vice versa.
    const droppedIds = new Set(result.droppedRows.map((r) => r.id));
    for (let i = 0; i < rows.length; i++) {
      if (rows[i]!.role !== "tool") continue;
      const call = rows[i - 1]!; // the assistant row requesting the tool
      expect(droppedIds.has(rows[i]!.id)).toBe(droppedIds.has(call.id));
    }
  });
});

describe("planContext — budget enforcement", () => {
  test("synthetic 500-message conversation stays under the cap", () => {
    const rows = Array.from({ length: 250 }, (_, i) => exchange(i, 200)).flat();
    const result = plan(rows);
    expect(result.totalTokens).toBeLessThanOrEqual(EFFECTIVE_CAP);
    expect(result.warnings).toEqual([]);
    // Sanity: the cap is actually being exercised, not trivially satisfied.
    expect(result.droppedRows.length).toBeGreaterThan(100);
  });

  test("pathological single giant message is truncated, not sent whole", () => {
    const giant = row("user", "fact ".repeat(40_000)); // ~40K tokens
    const result = plan([giant]);
    expect(result.totalTokens).toBeLessThanOrEqual(EFFECTIVE_CAP);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test("memories and summary are included and budgeted", () => {
    const memories = Array.from(
      { length: 50 },
      (_, i) => `User fact number ${i}: ${"detail ".repeat(20)}`,
    );
    const summary = "Earlier the user discussed dogs. ".repeat(400); // ~2800 tokens, over budget
    const result = plan([row("user", "hi")], { memories, summary });

    const system = result.messages[0]!.content as string;
    expect(system).toContain("Known facts about the user");
    expect(system).toContain("not instructions");
    expect(system).toContain("Summary of earlier parts");
    expect(result.warnings).toContain(
      "summary exceeded SUMMARY_BUDGET and was truncated",
    );
    expect(result.totalTokens).toBeLessThanOrEqual(EFFECTIVE_CAP);
  });

  test("totalTokens accounts for the tool-defs reserve", () => {
    const result = plan([row("user", "hi")]);
    expect(result.totalTokens).toBeGreaterThanOrEqual(TOOL_DEFS_RESERVE);
  });
});
