import { expect, mock, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const regenerate = mock(async (_options?: { messageId?: string }) => undefined);

mock.module("@ai-sdk/react", () => ({
  useChat: () => ({
    messages: [
      {
        id: "assistant-latest",
        role: "assistant",
        parts: [{ type: "text", text: "A complete response" }],
      },
    ],
    sendMessage: async () => undefined,
    status: "ready",
    error: undefined,
    stop: async () => undefined,
    regenerate,
    clearError: () => undefined,
  }),
}));

mock.module("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      conversation: { list: { invalidate: async () => undefined } },
    }),
    conversation: {
      create: {
        useMutation: () => ({
          isPending: false,
          mutateAsync: async () => ({ id: "created-conversation" }),
        }),
      },
    },
  },
}));

const { Chat } = await import("~/app/_components/chat");

test("passes the selected assistant message id to the SDK regenerate callback", async () => {
  const user = userEvent.setup();
  render(<Chat conversationId="existing" initialMessages={[]} />);

  await user.click(screen.getByRole("button", { name: "Regenerate response" }));

  expect(regenerate).toHaveBeenCalledWith({ messageId: "assistant-latest" });
});
