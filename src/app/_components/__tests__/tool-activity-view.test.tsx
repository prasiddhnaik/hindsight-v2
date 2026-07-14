import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";

import { ToolActivity } from "~/app/_components/tool-activity";

test("shows running tool status without an empty disclosure", () => {
  render(
    <ToolActivity
      activity={{
        id: "call-1",
        name: "Current date & time",
        status: "running",
        input: undefined,
      }}
    />,
  );

  expect(screen.getByText("Current date & time")).toBeTruthy();
  expect(screen.getByText("Running")).toBeTruthy();
  expect(document.querySelector("details")).toBeNull();
});

test("renders available tool data in a semantic disclosure", () => {
  render(
    <ToolActivity
      activity={{
        id: "call-2",
        name: "Calculator",
        status: "complete",
        input: { expression: "21 * 2" },
        output: { result: 42 },
      }}
    />,
  );

  const disclosure = document.querySelector("details");
  expect(disclosure).not.toBeNull();
  expect(disclosure?.getAttribute("aria-label")).toBe(
    "Calculator tool activity, Complete",
  );
  expect(disclosure?.querySelector("summary")?.textContent).toContain(
    "Calculator",
  );
  expect(disclosure?.textContent).toContain("Complete");
  expect(disclosure?.textContent).toContain('"result": 42');
  expect(disclosure?.querySelector("pre")?.className).toContain(
    "overflow-x-auto",
  );
});

test("renders tool failures as visible text, not color alone", () => {
  render(
    <ToolActivity
      activity={{
        id: "call-3",
        name: "Weather lookup",
        status: "failed",
        input: { city: "Pune" },
        errorText: "Service unavailable",
      }}
    />,
  );

  expect(screen.getByText("Failed")).toBeTruthy();
  expect(screen.getByText("Service unavailable")).toBeTruthy();
});
