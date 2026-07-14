import { expect, test } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";

import { ModalSheet } from "~/app/_components/modal-sheet";

function ModalHarness({ initiallyOpen = false }: { initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button ref={triggerRef} onClick={() => setOpen(true)}>
        Open navigation
      </button>
      <ModalSheet
        open={open}
        side="left"
        title="Navigation"
        triggerRef={triggerRef}
        onClose={() => setOpen(false)}
      >
        <button>First action</button>
        <a href="/settings">Last action</a>
      </ModalSheet>
    </>
  );
}

test("exposes modal dialog semantics and an accessible title", () => {
  render(<ModalHarness initiallyOpen />);

  const dialog = screen.getByRole("dialog", { name: "Navigation" });
  expect(dialog.getAttribute("aria-modal")).toBe("true");
});

test("closes when Escape is pressed", async () => {
  const user = userEvent.setup();
  render(<ModalHarness initiallyOpen />);

  await user.keyboard("{Escape}");

  expect(screen.queryByRole("dialog")).toBeNull();
});

test("closes when the scrim is pressed", async () => {
  const user = userEvent.setup();
  render(<ModalHarness initiallyOpen />);

  await user.click(
    screen.getByRole("button", { name: "Close navigation panel" }),
  );

  expect(screen.queryByRole("dialog")).toBeNull();
});

test("contains forward and reverse Tab focus within the sheet", async () => {
  const user = userEvent.setup();
  render(<ModalHarness initiallyOpen />);

  const firstAction = screen.getByRole("button", { name: "First action" });
  const lastAction = screen.getByRole("link", { name: "Last action" });

  await waitFor(() => expect(document.activeElement).toBe(firstAction));
  await user.keyboard("{Shift>}{Tab}{/Shift}");
  expect(document.activeElement).toBe(lastAction);

  await user.tab();
  expect(document.activeElement).toBe(firstAction);
});

test("restores focus to the trigger after close", async () => {
  const user = userEvent.setup();
  render(<ModalHarness />);

  const trigger = screen.getByRole("button", { name: "Open navigation" });
  await user.click(trigger);
  await user.keyboard("{Escape}");

  await waitFor(() => expect(document.activeElement).toBe(trigger));
});

test("restores the previous body overflow when unmounted", () => {
  document.body.style.overflow = "clip";
  const { unmount } = render(<ModalHarness initiallyOpen />);

  expect(document.body.style.overflow).toBe("hidden");
  unmount();

  expect(document.body.style.overflow).toBe("clip");
});
