import { expect, test } from "bun:test";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";

import {
  isWithinBottomThreshold,
  useStickToBottom,
} from "~/app/_components/use-stick-to-bottom";

test("uses a 96px bottom threshold", () => {
  expect(
    isWithinBottomThreshold({
      scrollTop: 704,
      clientHeight: 200,
      scrollHeight: 1000,
    }),
  ).toBe(true);
  expect(
    isWithinBottomThreshold({
      scrollTop: 703,
      clientHeight: 200,
      scrollHeight: 1000,
    }),
  ).toBe(false);
});

function StickHarness() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [version, setVersion] = useState(0);
  const { showJumpToLatest, jumpToLatest } = useStickToBottom(
    containerRef,
    version,
  );

  return (
    <>
      <div ref={containerRef} data-testid="scroller" />
      <button onClick={() => setVersion((current) => current + 1)}>
        Add content
      </button>
      {showJumpToLatest && (
        <button onClick={jumpToLatest}>Jump to latest</button>
      )}
    </>
  );
}

function setScrollMetrics(
  element: HTMLElement,
  metrics: { scrollTop: number; clientHeight: number; scrollHeight: number },
) {
  Object.defineProperties(element, {
    scrollTop: { configurable: true, writable: true, value: metrics.scrollTop },
    clientHeight: { configurable: true, value: metrics.clientHeight },
    scrollHeight: { configurable: true, value: metrics.scrollHeight },
  });
  Object.defineProperty(element, "scrollTo", {
    configurable: true,
    value: ({ top }: ScrollToOptions) => {
      element.scrollTop = top ?? element.scrollTop;
    },
  });
}

test("follows new content while near the bottom", async () => {
  const user = userEvent.setup();
  render(<StickHarness />);
  const scroller = screen.getByTestId("scroller");
  setScrollMetrics(scroller, {
    scrollTop: 704,
    clientHeight: 200,
    scrollHeight: 1000,
  });

  act(() => scroller.dispatchEvent(new Event("scroll")));
  Object.defineProperty(scroller, "scrollHeight", {
    configurable: true,
    value: 1200,
  });
  await user.click(screen.getByRole("button", { name: "Add content" }));

  expect(scroller.scrollTop).toBe(1200);
  expect(screen.queryByRole("button", { name: "Jump to latest" })).toBeNull();
});

test("stops following while reading older content, then jumps and resumes", async () => {
  const user = userEvent.setup();
  render(<StickHarness />);
  const scroller = screen.getByTestId("scroller");
  setScrollMetrics(scroller, {
    scrollTop: 400,
    clientHeight: 200,
    scrollHeight: 1000,
  });

  act(() => scroller.dispatchEvent(new Event("scroll")));
  expect(screen.getByRole("button", { name: "Jump to latest" })).toBeTruthy();

  await user.click(screen.getByRole("button", { name: "Add content" }));
  expect(scroller.scrollTop).toBe(400);

  await user.click(screen.getByRole("button", { name: "Jump to latest" }));
  expect(scroller.scrollTop).toBe(1000);
  expect(screen.queryByRole("button", { name: "Jump to latest" })).toBeNull();

  Object.defineProperty(scroller, "scrollHeight", {
    configurable: true,
    value: 1300,
  });
  await user.click(screen.getByRole("button", { name: "Add content" }));
  expect(scroller.scrollTop).toBe(1300);
});
