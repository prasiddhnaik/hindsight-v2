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
const START = new Date("2026-07-14T12:00:00.000Z").getTime();

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test("rate-limit feedback counts down from 60 seconds before enabling Retry", () => {
  jest.useFakeTimers();
  let now = START;
  spyOn(Date, "now").mockImplementation(() => now);
  const onRetry = mock(() => undefined);
  render(
    <ChatFeedback
      message={RATE_LIMIT}
      online
      rateLimitDeadline={START + 60_000}
      onRetry={onRetry}
    />,
  );

  const retry = screen.getByRole("button", { name: "Retry in 60 seconds" });
  expect((retry as HTMLButtonElement).disabled).toBe(true);
  expect(retry.className).toContain("tabular-nums");

  act(() => {
    now = START + 60_000;
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
    <ChatFeedback
      message={RATE_LIMIT}
      online
      rateLimitDeadline={START + 60_000}
      onRetry={() => undefined}
    />,
  );

  unmount();

  expect(clearIntervalSpy).toHaveBeenCalled();
  clearIntervalSpy.mockRestore();
});

test("rate-limit feedback uses the absolute deadline after delayed ticks", () => {
  jest.useFakeTimers();
  let now = START;
  spyOn(Date, "now").mockImplementation(() => now);
  render(
    <ChatFeedback
      message={RATE_LIMIT}
      online
      rateLimitDeadline={START + 60_000}
      onRetry={() => undefined}
    />,
  );

  now = START + 45_000;
  act(() => {
    jest.advanceTimersByTime(1_000);
  });

  expect(
    screen.getByRole("button", { name: "Retry in 15 seconds" }),
  ).toBeTruthy();
});

test("rate-limit deadline survives offline precedence", () => {
  jest.useFakeTimers();
  let now = START;
  spyOn(Date, "now").mockImplementation(() => now);
  const { rerender } = render(
    <ChatFeedback
      message={RATE_LIMIT}
      online
      rateLimitDeadline={START + 60_000}
      onRetry={() => undefined}
    />,
  );

  rerender(
    <ChatFeedback
      message={RATE_LIMIT}
      online={false}
      rateLimitDeadline={START + 60_000}
      onRetry={() => undefined}
    />,
  );
  now = START + 30_000;
  rerender(
    <ChatFeedback
      message={RATE_LIMIT}
      online
      rateLimitDeadline={START + 60_000}
      onRetry={() => undefined}
    />,
  );

  expect(
    screen.getByRole("button", { name: "Retry in 30 seconds" }),
  ).toBeTruthy();
});

test("countdown updates stay outside the assertive error announcement", () => {
  jest.useFakeTimers();
  spyOn(Date, "now").mockImplementation(() => START);
  render(
    <ChatFeedback
      message={RATE_LIMIT}
      online
      rateLimitDeadline={START + 60_000}
      onRetry={() => undefined}
    />,
  );

  const alert = screen.getByRole("alert");
  const retry = screen.getByRole("button", { name: "Retry in 60 seconds" });
  expect(alert.textContent).toBe(RATE_LIMIT);
  expect(alert.querySelector("button")).toBeNull();
  expect(retry.closest('[aria-live="off"]')).not.toBeNull();
});

test("provider feedback offers an explicit Retry action", async () => {
  const onRetry = mock(() => undefined);
  const user = userEvent.setup();
  render(
    <ChatFeedback
      message={PROVIDER}
      online
      rateLimitDeadline={null}
      onRetry={onRetry}
    />,
  );

  await user.click(screen.getByRole("button", { name: "Retry" }));

  expect(onRetry).toHaveBeenCalledTimes(1);
});

test("credential feedback shows configuration guidance without Retry", () => {
  render(
    <ChatFeedback
      message={CREDENTIALS}
      online
      rateLimitDeadline={null}
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
    <ChatFeedback
      message={PROVIDER}
      online={false}
      rateLimitDeadline={null}
      onRetry={() => undefined}
    />,
  );

  expect(screen.getByRole("alert").textContent).toContain("You're offline");
  expect(screen.queryByRole("button")).toBeNull();
});
