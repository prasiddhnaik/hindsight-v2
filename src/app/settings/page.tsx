"use client";

import { TrashIcon } from "~/app/_components/icons";
import { api } from "~/trpc/react";

export default function SettingsPage() {
  const utils = api.useUtils();
  const { data: memories, isLoading } = api.memory.list.useQuery();
  const deleteMemory = api.memory.delete.useMutation({
    onSuccess: () => void utils.memory.list.invalidate(),
  });

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-4 py-8 md:px-6 md:py-10">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>

        <section className="mt-8">
          <h2 className="text-sm font-medium text-ink">Long-term memory</h2>
          <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-muted">
            Facts the assistant has learned about you, provided to the model as
            background information only. Delete anything you don&apos;t want
            remembered.
          </p>

          <ul className="mt-5 space-y-2">
            {isLoading && (
              <li className="text-[13px] text-ink-muted">Loading…</li>
            )}
            {memories?.length === 0 && (
              <li className="rounded-xl border border-dashed border-hairline px-4 py-6 text-center text-[13px] text-ink-muted">
                Nothing saved yet — memories appear as you chat.
              </li>
            )}
            {memories?.map((memory) => (
              <li
                key={memory.id}
                className="group flex items-start justify-between gap-3 rounded-xl border border-hairline bg-surface px-4 py-3 transition-colors duration-150 hover:border-accent/25"
              >
                <div className="min-w-0">
                  <p className="text-[14px] leading-relaxed">{memory.content}</p>
                  <p className="mt-1 text-[11.5px] text-ink-muted">
                    {new Date(memory.createdAt).toLocaleString()}
                    {memory.category ? ` · ${memory.category}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => deleteMemory.mutate({ id: memory.id })}
                  aria-label={`Forget "${memory.content}"`}
                  title="Forget this"
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors duration-150 hover:bg-raised hover:text-danger focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none"
                >
                  <TrashIcon className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
