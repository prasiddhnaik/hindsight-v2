"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";

export default function ChatPage() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const isBusy = status === "submitted" || status === "streaming";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isBusy) return;
    setInput("");
    void sendMessage({ text });
  }

  return (
    <main className="mx-auto flex h-dvh max-w-3xl flex-col bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 px-4 py-3">
        <h1 className="text-sm font-semibold tracking-wide text-neutral-300">
          Hindsight
        </h1>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-6">
        {messages.length === 0 && (
          <p className="pt-24 text-center text-sm text-neutral-500">
            Ask anything to get started.
          </p>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={
              message.role === "user"
                ? "ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-2.5"
                : "w-fit max-w-[85%] rounded-2xl rounded-bl-sm bg-neutral-800 px-4 py-2.5"
            }
          >
            <p className="text-sm whitespace-pre-wrap">
              {message.parts
                .map((part) => (part.type === "text" ? part.text : ""))
                .join("")}
            </p>
          </div>
        ))}

        {status === "submitted" && (
          <div
            data-testid="streaming-indicator"
            className="w-fit rounded-2xl rounded-bl-sm bg-neutral-800 px-4 py-2.5"
          >
            <span className="text-sm text-neutral-400">
              Thinking
              <span className="animate-pulse">…</span>
            </span>
          </div>
        )}

        {error && (
          <div
            data-testid="chat-error"
            className="rounded-lg border border-red-800 bg-red-950/60 px-4 py-3 text-sm text-red-300"
          >
            {error.message ||
              "Something went wrong. Please try again in a moment."}
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex gap-2 border-t border-neutral-800 p-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message Hindsight…"
          autoFocus
          className="flex-1 rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm outline-none placeholder:text-neutral-500 focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={isBusy || input.trim() === ""}
          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isBusy ? "…" : "Send"}
        </button>
      </form>
    </main>
  );
}
