"use client";

import { api } from "~/trpc/react";

export default function SettingsPage() {
  const utils = api.useUtils();
  const { data: memories, isLoading } = api.memory.list.useQuery();
  const deleteMemory = api.memory.delete.useMutation({
    onSuccess: () => void utils.memory.list.invalidate(),
  });

  return (
    <main className="flex-1 overflow-y-auto px-6 py-8">
      <h1 className="text-lg font-semibold">Settings</h1>

      <section className="mt-6 max-w-2xl">
        <h2 className="text-sm font-semibold text-neutral-300">
          Long-term memory
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          Facts the assistant has learned about you. They are provided to the
          model as background information only. Delete anything you don&apos;t
          want remembered.
        </p>

        <ul className="mt-4 space-y-2">
          {isLoading && <li className="text-sm text-neutral-500">Loading…</li>}
          {memories?.length === 0 && (
            <li className="text-sm text-neutral-500">No memories saved yet.</li>
          )}
          {memories?.map((memory) => (
            <li
              key={memory.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm">{memory.content}</p>
                <p className="mt-0.5 text-xs text-neutral-600">
                  {new Date(memory.createdAt).toLocaleString()}
                  {memory.category ? ` · ${memory.category}` : ""}
                </p>
              </div>
              <button
                onClick={() => deleteMemory.mutate({ id: memory.id })}
                className="shrink-0 rounded p-1 text-xs text-neutral-500 hover:text-red-400"
                title="Forget this"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
