"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  CheckIcon,
  CloseIcon,
  GearIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "~/app/_components/icons";
import { api } from "~/trpc/react";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const utils = api.useUtils();

  const { data: conversations } = api.conversation.list.useQuery();

  // Inline rename state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editingId) editInputRef.current?.select();
  }, [editingId]);

  // Two-tap delete confirm state (auto-reverts)
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  useEffect(() => {
    if (!confirmingId) return;
    const t = setTimeout(() => setConfirmingId(null), 4000);
    return () => clearTimeout(t);
  }, [confirmingId]);

  const deleteConversation = api.conversation.delete.useMutation({
    onSuccess: (_data, variables) => {
      void utils.conversation.list.invalidate();
      if (pathname === `/chat/${variables.id}`) router.push("/");
    },
  });

  const renameConversation = api.conversation.rename.useMutation({
    onSuccess: () => void utils.conversation.list.invalidate(),
  });

  function commitRename(id: string, currentTitle: string) {
    const title = draft.trim();
    setEditingId(null);
    if (title && title !== currentTitle) {
      renameConversation.mutate({ id, title });
    }
  }

  return (
    <aside
      onClick={(e) => {
        // Any link click inside the drawer closes it on mobile.
        if ((e.target as HTMLElement).closest("a")) onNavigate?.();
      }}
      className="flex h-dvh w-64 shrink-0 flex-col border-r border-hairline bg-bg md:bg-surface/40"
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <Link href="/" className="group flex items-baseline gap-1.5">
          <span className="text-[15px] font-semibold tracking-tight">
            Hindsight
          </span>
          <span className="size-1.5 translate-y-[-1px] rounded-full bg-accent transition-transform duration-200 group-hover:scale-125" />
        </Link>
        <Link
          href="/"
          aria-label="New chat"
          title="New chat"
          className="flex size-7 items-center justify-center rounded-lg border border-hairline text-ink-secondary transition-colors duration-150 hover:border-accent/40 hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none"
        >
          <PlusIcon className="size-4" />
        </Link>
      </div>

      <p className="px-4 pt-2 pb-1.5 text-[11px] font-medium tracking-wide text-ink-muted uppercase">
        Recent
      </p>

      <nav className="flex-1 space-y-px overflow-y-auto px-2 pb-3">
        {conversations?.length === 0 && (
          <p className="px-2 pt-1 text-[13px] text-ink-muted">
            No conversations yet.
          </p>
        )}
        {conversations?.map((c) => {
          const active = pathname === `/chat/${c.id}`;

          if (editingId === c.id) {
            return (
              <div
                key={c.id}
                className="flex items-center rounded-lg bg-raised ring-1 ring-accent/40"
              >
                <input
                  ref={editInputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(c.id, c.title);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  onBlur={() => setEditingId(null)}
                  aria-label="Rename conversation"
                  className="min-w-0 flex-1 bg-transparent px-3 py-2 text-[13.5px] outline-none"
                />
                <button
                  onMouseDown={(e) => {
                    e.preventDefault(); // beat the input's blur
                    commitRename(c.id, c.title);
                  }}
                  aria-label="Save name"
                  className="mr-1.5 flex size-6 shrink-0 items-center justify-center rounded-md text-accent hover:bg-surface"
                >
                  <CheckIcon className="size-3.5" />
                </button>
              </div>
            );
          }

          if (confirmingId === c.id) {
            return (
              <div
                key={c.id}
                className="flex items-center gap-1 rounded-lg bg-raised px-3 py-1.5 ring-1 ring-danger/40"
              >
                <span className="min-w-0 flex-1 truncate text-[13px] text-danger">
                  Delete?
                </span>
                <button
                  onClick={() => {
                    setConfirmingId(null);
                    deleteConversation.mutate({ id: c.id });
                  }}
                  aria-label={`Confirm delete "${c.title}"`}
                  className="flex size-6 shrink-0 items-center justify-center rounded-md text-danger transition-colors duration-150 hover:bg-danger/15"
                >
                  <CheckIcon className="size-3.5" />
                </button>
                <button
                  onClick={() => setConfirmingId(null)}
                  aria-label="Cancel delete"
                  className="flex size-6 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors duration-150 hover:bg-surface hover:text-ink"
                >
                  <CloseIcon className="size-3.5" />
                </button>
              </div>
            );
          }

          return (
            <div
              key={c.id}
              className={`group relative flex items-center rounded-lg transition-colors duration-150 ${
                active ? "bg-raised" : "hover:bg-surface"
              }`}
            >
              {active && (
                <span className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent" />
              )}
              <Link
                href={`/chat/${c.id}`}
                title={c.title}
                className={`min-w-0 flex-1 truncate px-3 py-2 text-[13.5px] ${
                  active ? "text-ink" : "text-ink-secondary group-hover:text-ink"
                }`}
              >
                {c.title}
              </Link>
              <div className="mr-1.5 hidden shrink-0 items-center gap-0.5 group-hover:flex">
                <button
                  onClick={() => {
                    setDraft(c.title);
                    setEditingId(c.id);
                  }}
                  aria-label={`Rename "${c.title}"`}
                  title="Rename"
                  className="flex size-6 items-center justify-center rounded-md text-ink-muted transition-colors duration-150 hover:bg-raised hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none"
                >
                  <PencilIcon className="size-3.5" />
                </button>
                <button
                  onClick={() => setConfirmingId(c.id)}
                  aria-label={`Delete "${c.title}"`}
                  title="Delete"
                  className="flex size-6 items-center justify-center rounded-md text-ink-muted transition-colors duration-150 hover:bg-raised hover:text-danger focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none"
                >
                  <TrashIcon className="size-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-hairline p-2">
        <Link
          href="/settings"
          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none ${
            pathname === "/settings"
              ? "bg-raised text-ink"
              : "text-ink-secondary hover:bg-surface hover:text-ink"
          }`}
        >
          <GearIcon className="size-4" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
