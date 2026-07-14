import { expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { ChatComposer } from "~/app/_components/chat-composer";

interface HarnessProps {
  busy?: boolean;
  offline?: boolean;
  initialValue?: string;
  onSubmit?: () => void;
  onStop?: () => void;
}

function ComposerHarness({
  busy = false,
  offline = false,
  initialValue = "",
  onSubmit = () => undefined,
  onStop = () => undefined,
}: HarnessProps) {
  const [value, setValue] = useState(initialValue);

  return (
    <ChatComposer
      value={value}
      busy={busy}
      offline={offline}
      onChange={setValue}
      onSubmit={onSubmit}
      onStop={onStop}
    />
  );
}

test("Enter submits a non-empty draft", async () => {
  const onSubmit = mock(() => undefined);
  const user = userEvent.setup();
  render(<ComposerHarness onSubmit={onSubmit} />);

  await user.type(screen.getByRole("textbox", { name: "Message Hindsight" }), "Hello{Enter}");

  expect(onSubmit).toHaveBeenCalledTimes(1);
});

test("Shift+Enter inserts a newline without submitting", async () => {
  const onSubmit = mock(() => undefined);
  const user = userEvent.setup();
  render(<ComposerHarness onSubmit={onSubmit} />);

  const textarea = screen.getByRole("textbox", { name: "Message Hindsight" });
  await user.type(textarea, "First line");
  await user.keyboard("{Shift>}{Enter}{/Shift}Second line");

  expect((textarea as HTMLTextAreaElement).value).toBe(
    "First line\nSecond line",
  );
  expect(onSubmit).not.toHaveBeenCalled();
});

test("IME composition Enter does not submit", () => {
  const onSubmit = mock(() => undefined);
  render(<ComposerHarness initialValue="Composing" onSubmit={onSubmit} />);

  fireEvent.keyDown(
    screen.getByRole("textbox", { name: "Message Hindsight" }),
    { key: "Enter", isComposing: true },
  );

  expect(onSubmit).not.toHaveBeenCalled();
});

test("blank input cannot submit", async () => {
  const onSubmit = mock(() => undefined);
  const user = userEvent.setup();
  render(<ComposerHarness onSubmit={onSubmit} />);

  const textarea = screen.getByRole("textbox", { name: "Message Hindsight" });
  await user.type(textarea, "   {Enter}");

  expect(onSubmit).not.toHaveBeenCalled();
  expect(
    (screen.getByRole("button", { name: "Send message" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});

test("busy composer replaces Send with a Stop action", async () => {
  const onStop = mock(() => undefined);
  const user = userEvent.setup();
  render(<ComposerHarness busy initialValue="Keep draft" onStop={onStop} />);

  expect(screen.queryByRole("button", { name: "Send message" })).toBeNull();
  const stop = screen.getByRole("button", { name: "Stop generating" });
  expect(stop.className).toContain("size-11");

  await user.click(stop);
  expect(onStop).toHaveBeenCalledTimes(1);
});

test("offline composer disables Send and keeps readable feedback visible", () => {
  render(<ComposerHarness offline initialValue="Hello" />);

  expect(
    (screen.getByRole("button", { name: "Send message" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(screen.getByRole("status").textContent).toContain(
    "You're offline. Reconnect to send messages.",
  );
});

test("composer does not autofocus and exposes keyboard help", () => {
  render(<ComposerHarness />);

  const textarea = screen.getByRole("textbox", { name: "Message Hindsight" });
  expect(document.activeElement).not.toBe(textarea);
  expect(textarea.hasAttribute("autofocus")).toBe(false);

  const helpId = textarea.getAttribute("aria-describedby");
  expect(helpId).not.toBeNull();
  expect(document.getElementById(helpId ?? "")?.textContent).toContain(
    "Enter to send · Shift+Enter for new line",
  );
});

test("composer caps growth at 200px and then scrolls internally", () => {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "scrollHeight",
  );
  Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
    configurable: true,
    get: () => 260,
  });

  try {
    render(<ComposerHarness initialValue={"Line\n".repeat(20)} />);

    const textarea = screen.getByRole("textbox", { name: "Message Hindsight" });
    expect(textarea.style.height).toBe("200px");
    expect(textarea.style.overflowY).toBe("auto");
  } finally {
    if (descriptor) {
      Object.defineProperty(
        HTMLTextAreaElement.prototype,
        "scrollHeight",
        descriptor,
      );
    } else {
      Reflect.deleteProperty(HTMLTextAreaElement.prototype, "scrollHeight");
    }
  }
});
