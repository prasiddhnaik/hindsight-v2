"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useMemo, useRef, useState } from "react";

import { api } from "~/trpc/react";

interface ChatProps {
  conversationId: string | null;
  initialMessages: UIMessage[];
}

export function Chat({ conversationId, initialMessages }: ChatProps) {
  const [input, setInput] = useState("");
  const conversationIdRef = useRef(conversationId);
  const utils = api.useUtils();
  const createConversation = api.conversation.create.useMutation();

  // The server only needs the new message; history lives in the database.
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            conversationId: conversationIdRef.current,
            message: messages[messages.length - 1],
          },
        }),
      }),
    [],
  );

  const { messages, sendMessage, status, error } = useChat({
    transport,
    messages: initialMessages,
    onFinish: () => {
      // Title is set server-side from the first message; refresh the sidebar.
      void utils.conversation.list.invalidate();
    },
  });

  const isBusy = status === "submitted" || status === "streaming";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isBusy || createConversation.isPending) return;

    if (!conversationIdRef.current) {
      const { id } = await createConversation.mutateAsync();
      conversationIdRef.current = id;
      // Shallow URL swap — no remount, streaming continues undisturbed.
      window.history.replaceState(null, "", `/chat/${id}`);
      void utils.conversation.list.invalidate();
    }

    setInput("");
    void sendMessage({ text });
  }

  return (
    <div className="flex h-dvh flex-1 flex-col">
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
            {message.parts.some((part) => part.type.startsWith("tool-")) && (
              <p className="mb-1 text-xs text-neutral-500">
                🔧{" "}
                {message.parts
                  .filter((part) => part.type.startsWith("tool-"))
                  .map((part) => part.type.replace("tool-", ""))
                  .join(", ")}
              </p>
            )}
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
        onSubmit={(e) => void handleSubmit(e)}
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
    </div>
  );
}
