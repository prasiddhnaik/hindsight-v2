import type { FinishReason } from "ai";

import type { HistoryRow } from "./planContext";

export type ChatAction = "send" | "regenerate";
export type TimestampSupplier = () => Date;

export function monotonicTimestampSupplier(base: Date): TimestampSupplier {
  let offsetMs = 0;
  return () => new Date(base.getTime() + offsetMs++);
}

interface FinishedResponse {
  finishReason: FinishReason;
  text: string;
  steps: ReadonlyArray<{ toolResults: readonly unknown[] }>;
}

export async function replaceIfEligible(
  finish: FinishedResponse,
  replace: () => Promise<void>,
): Promise<boolean> {
  const hasCompletedToolActivity = finish.steps.some(
    (step) => step.toolResults.length > 0,
  );
  if (
    finish.finishReason === "error" ||
    (!finish.text.trim() && !hasCompletedToolActivity)
  ) {
    return false;
  }

  await replace();
  return true;
}

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
