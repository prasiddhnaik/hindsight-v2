import {
  afterEach,
  expect,
  jest,
  mock,
  spyOn,
  test,
} from "bun:test";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ChatFeedback } from "~/app/_components/chat-feedback";

const RATE_LIMIT =
  "The free model is rate-limited right now. Please wait a minute and try again.";
const CREDENTIALS =
  "The server's OpenRouter API key was rejected. Check the OPENROUTER_API_KEY configuration.";
const PROVIDER = "The AI provider returned an error. Please try again.";

afterEach(() => {
  jest.useRealTimers();
});

test("rate-limit feedback counts down from 60 seconds before enabling Retry", () => {
  jest.useFakeTimers();
  const onRetry = mock(() => undefined);
  render(<ChatFeedback message={RATE_LIMIT} online onRetry={onRetry} />);

  const retry = screen.getByRole("button", { name: "Retry in 60 seconds" });
  expect((retry as HTMLButtonElement).disabled).toBe(true);
  expect(retry.className).toContain("tabular-nums");

  act(() => {
    jest.advanceTimersByTime(60_000);
  });

  expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "Retry" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});

test("rate-limit feedback clears its interval when unmounted", () => {
  jest.useFakeTimers();
  const clearIntervalSpy = spyOn(window, "clearInterval");
  const { unmount } = render(
    <ChatFeedback message={RATE_LIMIT} online onRetry={() => undefined} />,
  );

  unmount();

  expect(clearIntervalSpy).toHaveBeenCalled();
  clearIntervalSpy.mockRestore();
});

test("provider feedback offers an explicit Retry action", async () => {
  const onRetry = mock(() => undefined);
  const user = userEvent.setup();
  render(<ChatFeedback message={PROVIDER} online onRetry={onRetry} />);

  await user.click(screen.getByRole("button", { name: "Retry" }));

  expect(onRetry).toHaveBeenCalledTimes(1);
});

test("credential feedback shows configuration guidance without Retry", () => {
  render(
    <ChatFeedback
      message={CREDENTIALS}
      online
      onRetry={() => undefined}
    />,
  );

  expect(screen.getByRole("alert").textContent).toContain(
    "OPENROUTER_API_KEY",
  );
  expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
});

test("offline feedback offers no futile network action", () => {
  render(
    <ChatFeedback message={PROVIDER} online={false} onRetry={() => undefined} />,
  );

  expect(screen.getByRole("alert").textContent).toContain("You're offline");
  expect(screen.queryByRole("button")).toBeNull();
});
