import { expect, mock, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UIMessage } from "ai";

import { MessageList } from "~/app/_components/message-list";

const messages: UIMessage[] = [
  {
    id: "user-1",
    role: "user",
    parts: [{ type: "text", text: "First question" }],
  },
  {
    id: "assistant-1",
    role: "assistant",
    parts: [{ type: "text", text: "First answer" }],
  },
  {
    id: "user-2",
    role: "user",
    parts: [{ type: "text", text: "Second question" }],
  },
  {
    id: "assistant-2",
    role: "assistant",
    parts: [{ type: "text", text: "Second answer" }],
  },
];

test("offers Regenerate only for the latest completed assistant response", async () => {
  const onRegenerate = mock((_messageId: string) => undefined);
  const user = userEvent.setup();
  render(
    <MessageList
      messages={messages}
      status="ready"
      onCopyMessage={async () => undefined}
      onRegenerate={onRegenerate}
    />,
  );

  const regenerate = screen.getByRole("button", { name: "Regenerate response" });
  expect(screen.getAllByRole("button", { name: "Regenerate response" })).toHaveLength(1);
  expect(regenerate.className).toContain("min-h-11");
  await user.click(regenerate);
  expect(onRegenerate).toHaveBeenCalledWith("assistant-2");
});

test("hides Regenerate while the latest response is incomplete or errored", () => {
  for (const status of ["submitted", "streaming", "error"] as const) {
    const { unmount } = render(
      <MessageList
        messages={messages}
        status={status}
        error={status === "error" ? new Error("Generation failed") : undefined}
        onCopyMessage={async () => undefined}
        onRegenerate={() => undefined}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Regenerate response" }),
    ).toBeNull();
    unmount();
  }
});

test("exposes touch-sized whole-message copy actions", async () => {
  const onCopyMessage = mock(async (_messageId: string, _text: string) => undefined);
  const user = userEvent.setup();
  render(
    <MessageList
      messages={messages.slice(0, 2)}
      status="ready"
      onCopyMessage={onCopyMessage}
      onRegenerate={() => undefined}
    />,
  );

  const copy = screen.getByRole("button", { name: "Copy message" });
  expect(copy.className).toContain("min-h-11");
  await user.click(copy);
  expect(onCopyMessage).toHaveBeenCalledWith("assistant-1", "First answer");
  expect((await screen.findByText("Copied")).textContent).toBe("Copied");
});

test("shows a visible thinking state with a polite live announcement", () => {
  render(
    <MessageList
      messages={messages.slice(0, 3)}
      status="submitted"
      onCopyMessage={async () => undefined}
      onRegenerate={() => undefined}
    />,
  );

  expect(screen.getByTestId("streaming-indicator").textContent).toContain("Thinking");
  const announcement = screen.getByTestId("chat-status-announcement");
  expect(announcement.getAttribute("aria-live")).toBe("polite");
  expect(announcement.textContent).toBe("Assistant is thinking");
});

test("announces errors assertively without adding an action", () => {
  render(
    <MessageList
      messages={messages}
      status="error"
      error={new Error("Generation failed")}
      onCopyMessage={async () => undefined}
      onRegenerate={() => undefined}
    />,
  );

  const announcement = screen.getByTestId("chat-error-announcement");
  expect(announcement.getAttribute("aria-live")).toBe("assertive");
  expect(announcement.textContent).toBe("Generation failed");
});

test("announces completion once when streaming becomes ready", () => {
  const props = {
    messages,
    error: undefined,
    onCopyMessage: async () => undefined,
    onRegenerate: () => undefined,
  };
  const { rerender } = render(<MessageList {...props} status="streaming" />);

  rerender(<MessageList {...props} status="ready" />);

  expect(screen.getByTestId("chat-status-announcement").textContent).toBe(
    "Response complete",
  );

  rerender(<MessageList {...props} status="ready" />);
  expect(screen.getByTestId("chat-status-announcement").textContent).toBe(
    "Response complete",
  );
});
