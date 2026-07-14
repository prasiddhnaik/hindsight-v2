import { expect, mock, test } from "bun:test";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { ConversationListItem } from "~/app/_components/conversation-groups";
import {
  SidebarView,
  type SidebarViewProps,
} from "~/app/_components/sidebar-view";

const now = new Date("2026-07-14T12:00:00+05:30");

function localTime(dayOffset: number, hours: number) {
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + dayOffset,
    hours,
  );
}

const items: ConversationListItem[] = [
  { id: "today", title: "Today chat", updatedAt: localTime(0, 10) },
  {
    id: "yesterday",
    title: "Yesterday chat",
    updatedAt: localTime(-1, 18),
  },
  { id: "earlier", title: "Earlier chat", updatedAt: localTime(-5, 9) },
];

function props(overrides: Partial<SidebarViewProps> = {}): SidebarViewProps {
  return {
    items,
    pathname: "/chat/today",
    isLoading: false,
    isError: false,
    onRetry: mock(() => undefined),
    onRename: mock(() => undefined),
    onDelete: mock(() => undefined),
    renamePending: false,
    renameError: null,
    deletePending: false,
    deleteError: null,
    now,
    ...overrides,
  };
}

test("renders non-animated loading skeletons", () => {
  const { container } = render(<SidebarView {...props({ isLoading: true })} />);

  expect(
    screen.getByRole("status", { name: "Loading conversations" }),
  ).toBeTruthy();
  expect(container.innerHTML).not.toContain("animate-");
});

test("renders a specific load error and retries the query", async () => {
  const user = userEvent.setup();
  const onRetry = mock(() => undefined);
  render(<SidebarView {...props({ isError: true, onRetry })} />);

  expect(screen.getByRole("alert").textContent).toContain(
    "Couldn’t load conversations.",
  );
  await user.click(screen.getByRole("button", { name: "Retry" }));
  expect(onRetry).toHaveBeenCalledTimes(1);
});

test("renders a helpful empty state after a successful query", () => {
  render(<SidebarView {...props({ items: [] })} />);

  expect(screen.getByText("Start a new conversation to see it here.")).toBeTruthy();
});

test("groups rows, formats timestamps, and marks the active route", () => {
  render(<SidebarView {...props()} />);

  expect(screen.getByRole("navigation", { name: "Conversations" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Today chat" }).getAttribute("aria-current")).toBe(
    "page",
  );
  expect(
    screen.getByRole("link", { name: "Yesterday chat" }).getAttribute("aria-current"),
  ).toBeNull();

  const todayRow = screen.getByRole("link", { name: "Today chat" }).closest("li");
  const yesterdayRow = screen
    .getByRole("link", { name: "Yesterday chat" })
    .closest("li");
  const earlierRow = screen.getByRole("link", { name: "Earlier chat" }).closest("li");
  const expectedTime = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(items[0]!.updatedAt);
  const expectedDate = new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
  }).format(items[2]!.updatedAt);

  expect(todayRow?.textContent).toContain(expectedTime);
  expect(yesterdayRow?.textContent).toContain("Yesterday");
  expect(earlierRow?.textContent).toContain(expectedDate);
});

test("keeps group heading relationships unique across multiple rails", () => {
  render(
    <>
      <SidebarView {...props()} />
      <SidebarView {...props()} />
    </>,
  );

  const todayHeadingIds = screen
    .getAllByRole("heading", { name: "Today" })
    .map((heading) => heading.id);
  expect(new Set(todayHeadingIds).size).toBe(todayHeadingIds.length);
});

test("keeps rename and delete actions reachable without hover", () => {
  render(<SidebarView {...props()} />);

  const rename = screen.getByRole("button", { name: 'Rename "Today chat"' });
  const remove = screen.getByRole("button", { name: 'Delete "Today chat"' });

  expect(rename.className).not.toContain("hidden");
  expect(remove.className).not.toContain("hidden");
  expect(rename.tabIndex).not.toBe(-1);
  expect(remove.tabIndex).not.toBe(-1);
  expect(rename.className).toContain("min-h-11");
  expect(remove.className).toContain("min-w-11");
});

test("saves a changed title with Enter but ignores empty and unchanged titles", async () => {
  const user = userEvent.setup();
  const onRename = mock(() => undefined);
  render(<SidebarView {...props({ onRename })} />);

  await user.click(screen.getByRole("button", { name: 'Rename "Today chat"' }));
  const input = screen.getByRole("textbox", { name: "Rename conversation" });
  await user.clear(input);
  await user.type(input, "Updated title{Enter}");
  expect(onRename).toHaveBeenCalledWith("today", "Updated title");

  await user.click(screen.getByRole("button", { name: 'Rename "Today chat"' }));
  await user.keyboard("{Enter}");
  await user.click(screen.getByRole("button", { name: 'Rename "Today chat"' }));
  await user.clear(screen.getByRole("textbox", { name: "Rename conversation" }));
  await user.keyboard("{Enter}");
  expect(onRename).toHaveBeenCalledTimes(1);
});

test("does not rename when draft and stored title differ only by whitespace", async () => {
  const user = userEvent.setup();
  const onRename = mock(() => undefined);
  const spacedItems = [
    { ...items[0]!, title: "  Today chat  " },
  ];
  render(<SidebarView {...props({ items: spacedItems, onRename })} />);

  await user.click(
    screen.getByRole("button", { name: /Rename.*Today chat/ }),
  );
  const input = screen.getByRole("textbox", { name: "Rename conversation" });
  await user.clear(input);
  await user.type(input, "Today chat{Enter}");

  expect(onRename).not.toHaveBeenCalled();
});

test("supports Escape plus explicit Save and Cancel without losing the draft on blur", async () => {
  const user = userEvent.setup();
  const onRename = mock(() => undefined);
  render(<SidebarView {...props({ onRename })} />);

  await user.click(screen.getByRole("button", { name: 'Rename "Today chat"' }));
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("textbox", { name: "Rename conversation" })).toBeNull();

  await user.click(screen.getByRole("button", { name: 'Rename "Today chat"' }));
  await user.clear(screen.getByRole("textbox", { name: "Rename conversation" }));
  await user.type(screen.getByRole("textbox", { name: "Rename conversation" }), "Saved title");
  fireEvent.blur(screen.getByRole("textbox", { name: "Rename conversation" }));
  await user.click(screen.getByRole("button", { name: "Save name" }));
  expect(onRename).toHaveBeenCalledWith("today", "Saved title");

  await user.click(screen.getByRole("button", { name: 'Rename "Today chat"' }));
  await user.click(screen.getByRole("button", { name: "Cancel rename" }));
  expect(screen.queryByRole("textbox", { name: "Rename conversation" })).toBeNull();
});

test("requires delete confirmation and supports cancellation", async () => {
  const user = userEvent.setup();
  const onDelete = mock(() => undefined);
  render(<SidebarView {...props({ onDelete })} />);

  await user.click(screen.getByRole("button", { name: 'Delete "Today chat"' }));
  expect(screen.getByText("Delete this conversation?")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Cancel delete" }));
  expect(onDelete).not.toHaveBeenCalled();

  await user.click(screen.getByRole("button", { name: 'Delete "Today chat"' }));
  await user.click(
    screen.getByRole("button", { name: 'Confirm delete "Today chat"' }),
  );
  expect(onDelete).toHaveBeenCalledWith("today");
});

test("moves focus into delete confirmation and restores it on cancel", async () => {
  const user = userEvent.setup();
  render(<SidebarView {...props()} />);

  await user.click(screen.getByRole("button", { name: 'Delete "Today chat"' }));
  const confirm = screen.getByRole("button", {
    name: 'Confirm delete "Today chat"',
  });
  expect(document.activeElement).toBe(confirm);

  await user.click(screen.getByRole("button", { name: "Cancel delete" }));
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: 'Delete "Today chat"' }),
  );
});

test("disables repeated delete confirmation and keeps failures visible", async () => {
  const user = userEvent.setup();
  const onDelete = mock(() => undefined);
  const view = render(<SidebarView {...props({ onDelete })} />);

  await user.click(screen.getByRole("button", { name: 'Delete "Today chat"' }));
  await user.click(
    screen.getByRole("button", { name: 'Confirm delete "Today chat"' }),
  );
  view.rerender(
    <SidebarView
      {...props({
        onDelete,
        deletePending: true,
      })}
    />,
  );

  const confirm = screen.getByRole("button", {
    name: 'Confirm delete "Today chat"',
  });
  expect(confirm.hasAttribute("disabled")).toBe(true);
  expect(onDelete).toHaveBeenCalledTimes(1);
  expect(within(confirm.closest("li")!).getByRole("status").textContent).toContain(
    "Deleting conversation",
  );

  view.rerender(
    <SidebarView
      {...props({
        onDelete,
        deleteError: "Delete failed. Try again.",
      })}
    />,
  );
  expect(screen.getByRole("alert").textContent).toContain("Delete failed. Try again.");
});

test("does not show a stale delete error under a new confirmation row", async () => {
  const user = userEvent.setup();
  const onDelete = mock(() => undefined);
  const view = render(<SidebarView {...props({ onDelete })} />);

  await user.click(screen.getByRole("button", { name: 'Delete "Today chat"' }));
  await user.click(
    screen.getByRole("button", { name: 'Confirm delete "Today chat"' }),
  );
  view.rerender(
    <SidebarView
      {...props({ onDelete, deleteError: "Delete failed. Try again." })}
    />,
  );
  expect(screen.getByRole("alert").textContent).toContain("Delete failed. Try again.");

  await user.click(screen.getByRole("button", { name: "Cancel delete" }));
  await user.click(
    screen.getByRole("button", { name: 'Delete "Yesterday chat"' }),
  );
  expect(screen.queryByRole("alert")).toBeNull();
});

test("announces rename mutation progress and failure", () => {
  const view = render(<SidebarView {...props({ renamePending: true })} />);
  expect(screen.getByRole("status").textContent).toContain("Renaming conversation");

  view.rerender(
    <SidebarView {...props({ renameError: "Rename failed. Try again." })} />,
  );
  expect(screen.getByRole("alert").textContent).toContain("Rename failed. Try again.");
});
