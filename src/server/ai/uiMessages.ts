import type { UIMessage } from "ai";

export interface StoredMessageRow {
  id: string;
  role: string;
  content: string;
  toolCalls: unknown;
  toolCallId: string | null;
  createdAt: Date;
}

interface StoredToolCall {
  toolCallId: string;
  toolName: string;
  input: unknown;
}

function storedToolCalls(value: unknown): StoredToolCall[] | null {
  if (!Array.isArray(value)) return null;
  const calls: StoredToolCall[] = [];
  for (const valueCall of value) {
    if (
      typeof valueCall !== "object" ||
      valueCall === null ||
      !("toolCallId" in valueCall) ||
      typeof valueCall.toolCallId !== "string" ||
      !("toolName" in valueCall) ||
      typeof valueCall.toolName !== "string"
    ) {
      return null;
    }
    calls.push({
      toolCallId: valueCall.toolCallId,
      toolName: valueCall.toolName,
      input: "input" in valueCall ? valueCall.input : undefined,
    });
  }
  return calls;
}

function parsedToolOutput(content: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    return content;
  }
}

export function storedRowsToUIMessages(rows: StoredMessageRow[]): UIMessage[] {
  const toolResults = new Map<string, StoredMessageRow>();
  for (const row of rows) {
    if (
      row.role === "tool" &&
      row.toolCallId &&
      !toolResults.has(row.toolCallId)
    ) {
      toolResults.set(row.toolCallId, row);
    }
  }

  const messages: UIMessage[] = [];
  for (const row of rows) {
    if (row.role === "user") {
      messages.push({
        id: row.id,
        role: "user",
        parts: [{ type: "text", text: row.content }],
      });
      continue;
    }
    if (row.role !== "assistant") continue;

    const calls = storedToolCalls(row.toolCalls);
    if (!calls || calls.length === 0) {
      messages.push({
        id: row.id,
        role: "assistant",
        parts: [{ type: "text", text: row.content }],
      });
      continue;
    }

    const parts: UIMessage["parts"] = calls.map((call) => {
      const result = toolResults.get(call.toolCallId);
      return result
        ? {
            type: "dynamic-tool",
            toolName: call.toolName,
            toolCallId: call.toolCallId,
            state: "output-available",
            input: call.input,
            output: parsedToolOutput(result.content),
          }
        : {
            type: "dynamic-tool",
            toolName: call.toolName,
            toolCallId: call.toolCallId,
            state: "input-available",
            input: call.input,
          };
    });
    const fallback = `[requested ${calls.map((call) => call.toolName).join(", ")}]`;
    if (row.content.trim() && row.content !== fallback) {
      parts.push({ type: "text", text: row.content });
    }
    messages.push({ id: row.id, role: "assistant", parts });
  }
  return messages;
}
