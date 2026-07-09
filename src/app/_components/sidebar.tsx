"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { api } from "~/trpc/react";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const utils = api.useUtils();

  const { data: conversations } = api.conversation.list.useQuery();

  const deleteConversation = api.conversation.delete.useMutation({
    onSuccess: (_data, variables) => {
      void utils.conversation.list.invalidate();
      if (pathname === `/chat/${variables.id}`) router.push("/");
    },
  });

  const renameConversation = api.conversation.rename.useMutation({
    onSuccess: () => void utils.conversation.list.invalidate(),
  });

  function handleRename(id: string, currentTitle: string) {
    const title = window.prompt("Rename conversation", currentTitle)?.trim();
    if (title && title !== currentTitle) {
      renameConversation.mutate({ id, title });
    }
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-neutral-800 bg-neutral-900/50">
      <div className="flex items-center justify-between px-4 py-3">
        <h1 className="text-sm font-semibold tracking-wide text-neutral-300">
          Hindsight
        </h1>
        <Link
          href="/"
          className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium hover:bg-indigo-500"
        >
          New chat
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
        {conversations?.length === 0 && (
          <p className="px-2 pt-2 text-xs text-neutral-600">
            No conversations yet.
          </p>
        )}
        {conversations?.map((c) => {
          const active = pathname === `/chat/${c.id}`;
          return (
            <div
              key={c.id}
              className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm ${
                active
                  ? "bg-neutral-800 text-neutral-100"
                  : "text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200"
              }`}
            >
              <Link
                href={`/chat/${c.id}`}
                className="min-w-0 flex-1 truncate"
                title={c.title}
              >
                {c.title}
              </Link>
              <button
                onClick={() => handleRename(c.id, c.title)}
                className="hidden rounded p-0.5 text-xs text-neutral-500 group-hover:block hover:text-neutral-200"
                title="Rename"
              >
                ✎
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`Delete "${c.title}"?`))
                    deleteConversation.mutate({ id: c.id });
                }}
                className="hidden rounded p-0.5 text-xs text-neutral-500 group-hover:block hover:text-red-400"
                title="Delete"
              >
                ✕
              </button>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-neutral-800 px-2 py-2">
        <Link
          href="/settings"
          className={`block rounded-lg px-2 py-1.5 text-sm ${
            pathname === "/settings"
              ? "bg-neutral-800 text-neutral-100"
              : "text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200"
          }`}
        >
          Settings
        </Link>
      </div>
    </aside>
  );
}
