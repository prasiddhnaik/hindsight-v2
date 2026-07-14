"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  AlertIcon,
  ArrowUpIcon,
  CheckIcon,
  CopyIcon,
  WrenchIcon,
} from "~/app/_components/icons";
import { api } from "~/trpc/react";

const SUGGESTIONS = [
  "Explain something I've always wondered about",
  "What's 15% of 2,847?",
  "Help me plan dinner this week",
];

interface ChatProps {
  conversationId: string | null;
  initialMessages: UIMessage[];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      aria-label={copied ? "Copied" : "Copy message"}
      title="Copy"
      className="flex size-7 items-center justify-center rounded-md text-ink-muted opacity-0 transition-all duration-150 group-hover:opacity-100 hover:bg-surface hover:text-ink focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none"
    >
      {copied ? (
        <CheckIcon className="size-3.5 text-accent" />
      ) : (
        <CopyIcon className="size-3.5" />
      )}
    </button>
  );
}

export function Chat({ conversationId, initialMessages }: ChatProps) {
  const [input, setInput] = useState("");
  const conversationIdRef = useRef(conversationId);
  const scrollRef = useRef<HTMLDivElement>(null);
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

  // Keep the newest message in view while streaming.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, status]);

  async function send(text: string) {
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void send(input.trim());
  }

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-4 py-8 md:px-6 md:py-10">
          {messages.length === 0 && (
            <div className="flex flex-col items-center pt-[14vh] text-center md:pt-[18vh]">
              <h1 className="font-display text-[28px] leading-tight text-ink italic md:text-[32px]">
                What can I help with?
              </h1>
              <p className="mt-3 text-sm text-ink-muted">
                Ask anything — I remember what matters across conversations.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => void send(s)}
                    className="rounded-full border border-hairline px-3.5 py-1.5 text-[13px] text-ink-secondary transition-colors duration-150 hover:border-accent/40 hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-7">
            {messages.map((message) => {
              const text = message.parts
                .map((part) => (part.type === "text" ? part.text : ""))
                .join("");
              const tools = message.parts
                .filter((part) => part.type.startsWith("tool-"))
                .map((part) => part.type.replace("tool-", ""));

              if (message.role === "user") {
                return (
                  <div key={message.id} className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-br-md bg-raised px-4 py-2.5">
                      <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                        {text}
                      </p>
                    </div>
                  </div>
                );
              }

              return (
                <div key={message.id} className="group">
                  {tools.length > 0 && (
                    <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-hairline px-2.5 py-1 text-[11.5px] text-ink-muted">
                      <WrenchIcon className="size-3" />
                      {tools.join(", ")}
                    </p>
                  )}
                  <div className="markdown text-[15px] leading-7 text-ink">
                    <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
                  </div>
                  {text && (
                    <div className="mt-1.5 flex">
                      <CopyButton text={text} />
                    </div>
                  )}
                </div>
              );
            })}

            {status === "submitted" && (
              <div
                data-testid="streaming-indicator"
                className="flex items-center gap-1 pt-1"
                aria-label="Assistant is thinking"
              >
                <span className="thinking-dot size-1.5 rounded-full bg-ink-secondary" />
                <span className="thinking-dot size-1.5 rounded-full bg-ink-secondary" />
                <span className="thinking-dot size-1.5 rounded-full bg-ink-secondary" />
              </div>
            )}

            {error && (
              <div
                data-testid="chat-error"
                className="flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-[13.5px] text-danger"
              >
                <AlertIcon className="mt-0.5 size-4 shrink-0" />
                <span>
                  {error.message ||
                    "Something went wrong. Please try again in a moment."}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6">
        <form
          onSubmit={handleSubmit}
          className="mx-auto w-full max-w-2xl rounded-2xl border border-hairline bg-surface transition-colors duration-200 focus-within:border-accent/50"
        >
          <div className="flex items-end gap-2 p-2 pl-4">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message Hindsight…"
              aria-label="Message Hindsight"
              autoFocus
              className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-ink-muted md:text-[15px]"
            />
            <button
              type="submit"
              disabled={isBusy || input.trim() === ""}
              aria-label="Send message"
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-bg transition-all duration-150 hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:bg-raised disabled:text-ink-muted md:size-9"
            >
              <ArrowUpIcon className="size-4" />
            </button>
          </div>
        </form>
        <p className="mx-auto mt-2 max-w-2xl text-center text-[11px] text-ink-muted">
          Gemma 4 · free tier — replies can be rate-limited at busy times
        </p>
      </div>
    </main>
  );
}
