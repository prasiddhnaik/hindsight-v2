import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";

import { MarkdownMessage } from "~/app/_components/markdown-message";

test("maps fenced code to CodeBlock while keeping inline code inline", () => {
  render(
    <MarkdownMessage
      text={"Use `answer` here.\n\n```ts\nconst answer = 42;\n```"}
    />,
  );

  expect(screen.getByText("TypeScript")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Copy code" })).toBeTruthy();
  expect(screen.getByText("answer").tagName).toBe("CODE");
});

test("keeps GFM tables inside an overflow-safe wrapper", () => {
  render(
    <MarkdownMessage text={"| Name | Value |\n| --- | --- |\n| Answer | 42 |"} />,
  );

  expect(screen.getByRole("table").parentElement?.className).toContain(
    "overflow-x-auto",
  );
});
