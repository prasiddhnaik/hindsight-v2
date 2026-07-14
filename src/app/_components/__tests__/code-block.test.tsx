import { beforeEach, expect, mock, test } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CodeBlock } from "~/app/_components/code-block";

const writeText = mock(async (_text: string) => undefined);

beforeEach(() => {
  writeText.mockReset();
  writeText.mockImplementation(async () => undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
});

test("shows a normalized fenced-code language label", () => {
  render(<CodeBlock code="const answer = 42;" language="ts" />);

  expect(screen.getByText("TypeScript")).toBeTruthy();
});

test("copies the code and announces success politely", async () => {
  const user = userEvent.setup();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  render(<CodeBlock code="const answer = 42;" language="typescript" />);

  const copy = screen.getByRole("button", { name: "Copy code" });
  expect(copy.className).toContain("size-11");
  await user.click(copy);

  expect(writeText).toHaveBeenCalledWith("const answer = 42;");
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Copied"));
  expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
});

test("does not announce success when clipboard copying fails", async () => {
  writeText.mockImplementation(async () => {
    throw new Error("Clipboard unavailable");
  });
  const user = userEvent.setup();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  render(<CodeBlock code="echo no" language="bash" />);

  await user.click(screen.getByRole("button", { name: "Copy code" }));

  await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
  expect(screen.queryByText("Copied")).toBeNull();
  expect(screen.getByRole("button", { name: "Copy code" })).toBeTruthy();
});

test("keeps long code in a horizontally scrollable region", () => {
  render(<CodeBlock code="averylongunbrokentoken" />);

  expect(screen.getByTestId("code-scroll-region").className).toContain(
    "overflow-x-auto",
  );
});
