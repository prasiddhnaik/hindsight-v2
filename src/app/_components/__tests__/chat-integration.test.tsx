import { beforeEach, expect, mock, test } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const sendMessage = mock(async (_message: { text: string }) => undefined);
const stop = mock(async () => undefined);
const regenerate = mock(async () => undefined);
const clearError = mock(() => undefined);
const invalidate = mock(async () => undefined);
const mutateAsync = mock(async () => ({ id: "created-conversation" }));

let chatStatus: "ready" | "submitted" | "streaming" | "error" = "ready";
let chatError: Error | undefined;

mock.module("@ai-sdk/react", () => ({
  useChat: () => ({
    messages: [],
    sendMessage,
    status: chatStatus,
    error: chatError,
    stop,
    regenerate,
    clearError,
  }),
}));

mock.module("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ conversation: { list: { invalidate } } }),
    conversation: {
      create: {
        useMutation: () => ({ isPending: false, mutateAsync }),
      },
    },
  },
}));

const { Chat } = await import("~/app/_components/chat");

beforeEach(() => {
  chatStatus = "ready";
  chatError = undefined;
  sendMessage.mockClear();
  stop.mockClear();
  regenerate.mockClear();
  clearError.mockClear();
  invalidate.mockClear();
  mutateAsync.mockReset();
  mutateAsync.mockImplementation(async () => ({ id: "created-conversation" }));
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  });
});

test("conversation-create failure stays visible and preserves the draft", async () => {
  mutateAsync.mockImplementation(async () => {
    throw new Error("Could not create the conversation.");
  });
  const user = userEvent.setup();
  render(<Chat conversationId={null} initialMessages={[]} />);

  const composer = screen.getByRole("textbox", { name: "Message Hindsight" });
  await user.type(composer, "Keep this draft{Enter}");

  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain(
      "Could not create the conversation.",
    ),
  );
  expect((composer as HTMLTextAreaElement).value).toBe("Keep this draft");
  expect(sendMessage).not.toHaveBeenCalled();
});

test("successful lazy creation starts send before clearing the draft", async () => {
  const user = userEvent.setup();
  render(<Chat conversationId={null} initialMessages={[]} />);

  const composer = screen.getByRole("textbox", { name: "Message Hindsight" });
  await user.type(composer, "Send this{Enter}");

  await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
  expect(sendMessage).toHaveBeenCalledWith({ text: "Send this" });
  expect((composer as HTMLTextAreaElement).value).toBe("");
  expect(window.location.pathname).toBe("/chat/created-conversation");
});

test("streaming Stop action uses the AI SDK stop helper", async () => {
  chatStatus = "streaming";
  const user = userEvent.setup();
  render(<Chat conversationId="existing" initialMessages={[]} />);

  await user.click(screen.getByRole("button", { name: "Stop generating" }));

  expect(stop).toHaveBeenCalledTimes(1);
});

test("Retry clears the SDK error before regenerating", async () => {
  chatError = new Error("The AI provider returned an error. Please try again.");
  const order: string[] = [];
  clearError.mockImplementation(() => {
    order.push("clear");
  });
  regenerate.mockImplementation(async () => {
    order.push("regenerate");
  });
  const user = userEvent.setup();
  render(<Chat conversationId="existing" initialMessages={[]} />);

  await user.click(screen.getByRole("button", { name: "Retry" }));

  expect(order).toEqual(["clear", "regenerate"]);
});
