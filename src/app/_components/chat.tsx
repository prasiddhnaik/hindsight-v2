"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useMemo, useRef, useState } from "react";

import { ChatComposer } from "~/app/_components/chat-composer";
import { RATE_LIMIT_MESSAGE } from "~/app/_components/chat-error";
import { ChatFeedback } from "~/app/_components/chat-feedback";
import { MessageList } from "~/app/_components/message-list";
import { useNetworkStatus } from "~/app/_components/use-network-status";
import { useStickToBottom } from "~/app/_components/use-stick-to-bottom";
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

interface BuildChatRequestBodyOptions {
  trigger: "submit-message" | "regenerate-message";
  conversationId: string;
  messages: UIMessage[];
}

export function buildChatRequestBody({
  trigger,
  conversationId,
  messages,
}: BuildChatRequestBodyOptions) {
  if (trigger === "regenerate-message") {
    return { action: "regenerate" as const, conversationId };
  }

  const message = [...messages]
    .reverse()
    .find(({ role }) => role === "user")!;
  return { action: "send" as const, conversationId, message };
}

export function Chat({ conversationId, initialMessages }: ChatProps) {
  const [input, setInput] = useState("");
  const [creationError, setCreationError] = useState<string | null>(null);
  const conversationIdRef = useRef(conversationId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rateLimitCooldownRef = useRef<{
    startedAt: number;
    deadline: number;
  } | null>(null);
  const online = useNetworkStatus();
  const utils = api.useUtils();
  const createConversation = api.conversation.create.useMutation();

  // The server only needs the new message; history lives in the database.
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ trigger, messages }) => ({
          body: buildChatRequestBody({
            trigger,
            messages,
            conversationId: conversationIdRef.current!,
          }),
        }),
      }),
    [],
  );

  const {
    messages,
    sendMessage,
    status,
    error,
    stop,
    regenerate,
    clearError,
  } = useChat({
    transport,
    messages: initialMessages,
    onFinish: () => {
      // Title is set server-side from the first message; refresh the sidebar.
      void utils.conversation.list.invalidate();
    },
  });

  const isBusy = status === "submitted" || status === "streaming";
  const messageContentVersion = useMemo(
    () => `${status}:${JSON.stringify(messages)}`,
    [messages, status],
  );
  const { showJumpToLatest, jumpToLatest } = useStickToBottom(
    scrollRef,
    messageContentVersion,
  );
  const feedbackMessage =
    creationError ??
    (error
      ? error.message ||
        "Something went wrong while generating a response. Please try again."
      : null);
  if (
    feedbackMessage === RATE_LIMIT_MESSAGE &&
    rateLimitCooldownRef.current === null
  ) {
    const startedAt = Date.now();
    rateLimitCooldownRef.current = {
      startedAt,
      deadline: startedAt + 60_000,
    };
  } else if (feedbackMessage !== RATE_LIMIT_MESSAGE) {
    rateLimitCooldownRef.current = null;
  }
  const rateLimitDeadline = rateLimitCooldownRef.current?.deadline ?? null;

  async function send(text: string) {
    const message = text.trim();
    if (!message || !online || isBusy || createConversation.isPending) return;

    setCreationError(null);

    if (!conversationIdRef.current) {
      try {
        const { id } = await createConversation.mutateAsync();
        conversationIdRef.current = id;
        // Shallow URL swap — no remount, streaming continues undisturbed.
        window.history.replaceState(null, "", `/chat/${id}`);
        void utils.conversation.list.invalidate();
      } catch (cause) {
        setCreationError(
          cause instanceof Error
            ? cause.message
            : "Could not create the conversation. Please try again.",
        );
        return;
      }
    }

    void sendMessage({ text: message });
    setInput("");
  }

  return (
    <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[720px] px-4 py-8 md:px-6 md:py-10">
          {messages.length === 0 && (
            <div className="flex flex-col items-center pt-[14vh] text-center md:pt-[18vh]">
              <h1 className="font-display text-[30px] leading-tight text-ink italic md:text-[34px]">
                What can I help with?
              </h1>
              <p className="mt-3 max-w-md text-base text-ink-muted">
                Ask anything — I remember what matters across conversations.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => void send(s)}
                    className="min-h-11 rounded-full border border-hairline px-4 text-base text-ink-secondary transition-colors duration-150 hover:border-accent/40 hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none md:text-sm"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <MessageList
            messages={messages}
            status={status}
            error={error}
            onCopyMessage={(_messageId, text) =>
              navigator.clipboard.writeText(text)
            }
            onRegenerate={(messageId) => {
              void regenerate({ messageId });
            }}
          />

          <div className="mt-4">
            {online && feedbackMessage && (
              <ChatFeedback
                message={feedbackMessage}
                online={online}
                rateLimitDeadline={rateLimitDeadline}
                onRetry={
                  creationError
                    ? undefined
                    : () => {
                        clearError();
                        void regenerate();
                      }
                }
              />
            )}
          </div>
        </div>
      </div>

      {showJumpToLatest && (
        <div className="pointer-events-none absolute inset-x-0 bottom-32 flex justify-center px-4">
          <button
            type="button"
            onClick={jumpToLatest}
            className="pointer-events-auto min-h-11 rounded-full border border-hairline bg-raised px-4 text-sm text-ink shadow-lift transition-transform duration-150 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none"
          >
            Jump to latest
          </button>
        </div>
      )}

      <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6">
        <div className="mx-auto w-full max-w-[720px]">
          <ChatComposer
            value={input}
            busy={isBusy}
            offline={!online}
            onChange={setInput}
            onSubmit={() => void send(input)}
            onStop={() => void stop()}
          />
        </div>
        <p className="mx-auto mt-2 max-w-[720px] text-center text-base text-ink-muted md:text-[11px]">
          Gemma 4 · free tier — replies can be rate-limited at busy times
        </p>
      </div>
    </main>
  );
}
