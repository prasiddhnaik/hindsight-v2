import { expect, test } from "bun:test";
import type { UIMessage } from "ai";

import { buildChatRequestBody } from "~/app/_components/chat";

const conversationId = "clx123456789012345678901234";
const firstUser: UIMessage = {
  id: "user-1",
  role: "user",
  parts: [{ type: "text", text: "First" }],
};
const newestUser: UIMessage = {
  id: "user-2",
  role: "user",
  parts: [{ type: "text", text: "Newest" }],
};
const assistant: UIMessage = {
  id: "assistant-1",
  role: "assistant",
  parts: [{ type: "text", text: "Answer" }],
};

test("submit-message sends the newest user message with action send", () => {
  expect(
    buildChatRequestBody({
      trigger: "submit-message",
      conversationId,
      messages: [firstUser, newestUser, assistant],
    }),
  ).toEqual({
    action: "send",
    conversationId,
    message: newestUser,
  });
});

test("regenerate-message sends only action regenerate and conversation ID", () => {
  expect(
    buildChatRequestBody({
      trigger: "regenerate-message",
      conversationId,
      messages: [firstUser, assistant],
    }),
  ).toEqual({
    action: "regenerate",
    conversationId,
  });
});
