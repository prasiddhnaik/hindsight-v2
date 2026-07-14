"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import {
  groupConversations,
  type ConversationGroupLabel,
  type ConversationListItem,
} from "~/app/_components/conversation-groups";
import {
  CheckIcon,
  CloseIcon,
  GearIcon,
  PencilIcon,
  PlusIcon,
  RefreshIcon,
  TrashIcon,
} from "~/app/_components/icons";

export interface SidebarViewProps {
  items: ConversationListItem[];
  pathname: string;
  isLoading: boolean;
  isError: boolean;
  onRetry(): void;
  onRename(id: string, title: string): void;
  onDelete(id: string): void;
  renamePending: boolean;
  renameError: string | null;
  deletePending: boolean;
  deleteError: string | null;
  onNavigate?(): void;
  now?: Date;
}

const focusRing =
  "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg focus-visible:outline-none";

function formatTimestamp(
  label: ConversationGroupLabel,
  updatedAt: Date,
): string {
  if (label === "Yesterday") return "Yesterday";

  return label === "Today"
    ? new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }).format(updatedAt)
    : new Intl.DateTimeFormat(undefined, { dateStyle: "short" }).format(
        updatedAt,
      );
}

export function SidebarView({
  items,
  pathname,
  isLoading,
  isError,
  onRetry,
  onRename,
  onDelete,
  renamePending,
  renameError,
  deletePending,
  deleteError,
  onNavigate,
  now = new Date(),
}: SidebarViewProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const groupHeadingPrefix = useId();
  const groups = groupConversations(items, now);

  useEffect(() => {
    if (!editingId) return;
    editInputRef.current?.focus();
    editInputRef.current?.select();
  }, [editingId]);

  function beginRename(item: ConversationListItem) {
    setConfirmingId(null);
    setDraft(item.title);
    setEditingId(item.id);
  }

  function commitRename(item: ConversationListItem) {
    const title = draft.trim();
    setEditingId(null);
    if (title && title !== item.title) onRename(item.id, title);
  }

  return (
    <aside
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a")) onNavigate?.();
      }}
      className="flex h-dvh w-[272px] shrink-0 flex-col border-r border-hairline bg-surface md:w-[240px] lg:w-[272px]"
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <Link
          href="/"
          aria-current={pathname === "/" ? "page" : undefined}
          className={`flex min-h-11 items-center gap-2 rounded-lg px-1 ${focusRing}`}
        >
          <span className="text-[15px] font-semibold tracking-tight">
            Hindsight
          </span>
          <span className="size-1.5 rounded-full bg-accent" />
        </Link>
        <Link
          href="/"
          aria-label="New conversation"
          title="New conversation"
          className={`flex size-11 items-center justify-center rounded-xl border border-hairline text-ink-secondary transition-colors duration-fast hover:border-accent/40 hover:bg-raised hover:text-ink ${focusRing}`}
        >
          <PlusIcon className="size-4" />
        </Link>
      </div>

      <nav
        aria-label="Conversations"
        className="min-h-0 flex-1 overflow-y-auto px-2 pb-4"
      >
        {isLoading ? (
          <div role="status" aria-label="Loading conversations" className="space-y-3 px-2 pt-3">
            <span className="sr-only">Loading conversations</span>
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="space-y-2 py-1">
                <div className="h-3 w-16 rounded-full bg-raised" />
                <div className="h-11 rounded-xl bg-raised" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="mx-2 mt-3 rounded-xl border border-danger/30 bg-danger/10 p-3">
            <p role="alert" className="text-sm text-danger">
              Couldn’t load conversations.
            </p>
            <button
              type="button"
              onClick={onRetry}
              className={`mt-2 flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-ink transition-colors duration-fast hover:bg-raised ${focusRing}`}
            >
              <RefreshIcon className="size-4" />
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="px-3 pt-4">
            <p className="text-sm font-medium text-ink-secondary">
              No conversations yet
            </p>
            <p className="mt-1 text-xs leading-5 text-ink-muted">
              Start a new conversation to see it here.
            </p>
          </div>
        ) : (
          <div className="space-y-5 pt-2">
            {groups.map((group) => (
              <section
                key={group.label}
                aria-labelledby={`${groupHeadingPrefix}-conversation-group-${group.label.toLowerCase()}`}
              >
                <h2
                  id={`${groupHeadingPrefix}-conversation-group-${group.label.toLowerCase()}`}
                  className="px-3 pb-1.5 text-[11px] font-semibold tracking-[0.08em] text-ink-muted uppercase"
                >
                  {group.label}
                </h2>
                <ul className="space-y-1">
                  {group.items.map((item) => {
                    const active = pathname === `/chat/${item.id}`;
                    const editing = editingId === item.id;
                    const confirming = confirmingId === item.id;

                    if (editing) {
                      return (
                        <li
                          key={item.id}
                          className="rounded-xl bg-raised ring-1 ring-accent/50"
                        >
                          <div className="flex items-center">
                            <input
                              ref={editInputRef}
                              value={draft}
                              onChange={(event) => setDraft(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") commitRename(item);
                                if (event.key === "Escape") setEditingId(null);
                              }}
                              aria-label="Rename conversation"
                              className={`min-h-11 min-w-0 flex-1 bg-transparent px-3 text-sm text-ink outline-none ${focusRing}`}
                            />
                            <button
                              type="button"
                              onClick={() => commitRename(item)}
                              disabled={renamePending}
                              aria-label="Save name"
                              className={`flex size-11 shrink-0 items-center justify-center rounded-lg text-accent transition-colors duration-fast hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
                            >
                              <CheckIcon className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              aria-label="Cancel rename"
                              className={`flex size-11 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors duration-fast hover:bg-surface hover:text-ink ${focusRing}`}
                            >
                              <CloseIcon className="size-4" />
                            </button>
                          </div>
                        </li>
                      );
                    }

                    if (confirming) {
                      return (
                        <li
                          key={item.id}
                          className="rounded-xl bg-raised px-2 py-1 ring-1 ring-danger/40"
                        >
                          <div className="flex items-center">
                            <span className="min-w-0 flex-1 px-1 text-xs font-medium text-danger">
                              Delete this conversation?
                            </span>
                            <button
                              type="button"
                              onClick={() => onDelete(item.id)}
                              disabled={deletePending}
                              aria-label={`Confirm delete "${item.title}"`}
                              className={`flex size-11 shrink-0 items-center justify-center rounded-lg text-danger transition-colors duration-fast hover:bg-danger/15 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
                            >
                              <CheckIcon className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingId(null)}
                              disabled={deletePending}
                              aria-label="Cancel delete"
                              className={`flex size-11 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors duration-fast hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
                            >
                              <CloseIcon className="size-4" />
                            </button>
                          </div>
                          {deletePending && (
                            <p role="status" className="sr-only">
                              Deleting conversation
                            </p>
                          )}
                          {deleteError && (
                            <p role="alert" className="px-1 pb-2 text-xs text-danger">
                              {deleteError}
                            </p>
                          )}
                        </li>
                      );
                    }

                    return (
                      <li
                        key={item.id}
                        className={`group relative flex min-h-11 items-stretch rounded-xl transition-colors duration-fast ${
                          active ? "bg-raised" : "hover:bg-raised/70"
                        }`}
                      >
                        {active && (
                          <span className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-accent" />
                        )}
                        <Link
                          href={`/chat/${item.id}`}
                          aria-label={item.title}
                          aria-current={active ? "page" : undefined}
                          title={item.title}
                          className={`flex min-w-0 flex-1 flex-col justify-center rounded-xl py-1.5 pr-1 pl-3 ${focusRing}`}
                        >
                          <span
                            className={`truncate text-[13px] font-medium ${
                              active ? "text-ink" : "text-ink-secondary"
                            }`}
                          >
                            {item.title}
                          </span>
                          <span className="text-[11px] leading-4 text-ink-muted">
                            {formatTimestamp(group.label, item.updatedAt)}
                          </span>
                        </Link>
                        <div className="flex shrink-0 items-center opacity-80 transition-opacity duration-fast group-hover:opacity-100 group-focus-within:opacity-100">
                          <button
                            type="button"
                            onClick={() => beginRename(item)}
                            disabled={renamePending}
                            aria-label={`Rename "${item.title}"`}
                            title="Rename"
                            className={`flex min-h-11 min-w-11 items-center justify-center rounded-lg text-ink-muted transition-colors duration-fast hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
                          >
                            <PencilIcon className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setConfirmingId(item.id);
                            }}
                            aria-label={`Delete "${item.title}"`}
                            title="Delete"
                            className={`flex min-h-11 min-w-11 items-center justify-center rounded-lg text-ink-muted transition-colors duration-fast hover:bg-surface hover:text-danger ${focusRing}`}
                          >
                            <TrashIcon className="size-3.5" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}

        {renamePending && (
          <p role="status" className="sr-only">
            Renaming conversation
          </p>
        )}
        {renameError && (
          <p role="alert" className="mx-3 mt-3 text-xs text-danger">
            {renameError}
          </p>
        )}
      </nav>

      <div className="border-t border-hairline p-2">
        <Link
          href="/settings"
          aria-current={pathname === "/settings" ? "page" : undefined}
          className={`flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm transition-colors duration-fast ${focusRing} ${
            pathname === "/settings"
              ? "bg-raised text-ink"
              : "text-ink-secondary hover:bg-raised hover:text-ink"
          }`}
        >
          <GearIcon className="size-4" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
