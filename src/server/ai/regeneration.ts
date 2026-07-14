import type { HistoryRow } from "./planContext";

export type ChatAction = "send" | "regenerate";

export function rowsForGeneration(
  rows: HistoryRow[],
  action: ChatAction,
): HistoryRow[] {
  if (action === "send") return rows;

  let latestUserIndex = rows.length - 1;
  while (latestUserIndex >= 0 && rows[latestUserIndex]?.role !== "user") {
    latestUserIndex -= 1;
  }
  if (latestUserIndex < 0) {
    throw new Error("Cannot regenerate without a user message");
  }

  return rows.slice(0, latestUserIndex + 1);
}
