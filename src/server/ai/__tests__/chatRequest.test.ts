import { describe, expect, test } from "bun:test";

import { parseChatRequest } from "../chatRequest";

const conversationId = "clx123456789012345678901234";
const message = {
  id: "message-1",
  role: "user",
  parts: [{ type: "text", text: "Hello" }],
};

describe("parseChatRequest", () => {
  test("accepts the existing send body without an action", () => {
    const request = parseChatRequest({ conversationId, message });

    expect(request).not.toBeNull();
    expect(request?.action ?? "send").toBe("send");
    expect(request && "message" in request ? request.message.id : null).toBe(
      "message-1",
    );
  });

  test("rejects a regenerate request that supplies a message", () => {
    expect(
      parseChatRequest({ action: "regenerate", conversationId, message }),
    ).toBeNull();
  });
});
