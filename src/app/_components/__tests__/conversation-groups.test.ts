import { describe, expect, test } from "bun:test";

import {
  groupConversations,
  type ConversationListItem,
} from "~/app/_components/conversation-groups";

const now = new Date("2026-07-14T12:00:00+05:30");

function conversation(
  id: string,
  updatedAt: Date,
): ConversationListItem {
  return { id, title: `Conversation ${id}`, updatedAt };
}

function localTime(dayOffset: number, hours: number, minutes = 0) {
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + dayOffset,
    hours,
    minutes,
  );
}

describe("groupConversations", () => {
  test("uses local calendar-day boundaries", () => {
    const groups = groupConversations(
      [
        conversation("today", localTime(0, 0)),
        conversation("yesterday", localTime(-1, 23, 59)),
        conversation("earlier", localTime(-2, 23, 59)),
      ],
      now,
    );

    expect(groups.map(({ label, items }) => [label, items.map(({ id }) => id)])).toEqual([
      ["Today", ["today"]],
      ["Yesterday", ["yesterday"]],
      ["Earlier", ["earlier"]],
    ]);
  });

  test("preserves the input order within each group", () => {
    const groups = groupConversations(
      [
        conversation("newest-today", localTime(0, 11)),
        conversation("newest-earlier", localTime(-4, 11)),
        conversation("older-today", localTime(0, 9)),
        conversation("older-earlier", localTime(-13, 11)),
      ],
      now,
    );

    expect(groups[0]?.items.map(({ id }) => id)).toEqual([
      "newest-today",
      "older-today",
    ]);
    expect(groups[1]?.items.map(({ id }) => id)).toEqual([
      "newest-earlier",
      "older-earlier",
    ]);
  });

  test("omits labels for empty groups while keeping label order", () => {
    const groups = groupConversations(
      [conversation("earlier", localTime(-13, 11))],
      now,
    );

    expect(groups.map(({ label }) => label)).toEqual(["Earlier"]);
  });
});
