"use client";

import type { ChatStatus, UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";

import { CheckIcon, CopyIcon } from "~/app/_components/icons";
import { MarkdownMessage } from "~/app/_components/markdown-message";
import {
  ToolActivity,
  toolPartToViewModel,
} from "~/app/_components/tool-activity";

interface MessageListProps {
  messages: UIMessage[];
  status: ChatStatus;
  error?: Error;
  onCopyMessage: (messageId: string, text: string) => void | Promise<void>;
  onRegenerate: (messageId: string) => void;
}

interface MessageActionsProps {
  messageId: string;
  text: string;
  canRegenerate: boolean;
  onCopyMessage: MessageListProps["onCopyMessage"];
  onRegenerate: MessageListProps["onRegenerate"];
}

function MessageActions({
  messageId,
  text,
  canRegenerate,
  onCopyMessage,
  onRegenerate,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    },
    [],
  );

  async function copyMessage() {
    try {
      await onCopyMessage(messageId, text);
      setCopied(true);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="message-actions mt-1.5 flex min-h-11 items-center gap-1">
      {text && (
        <button
          type="button"
          onClick={() => void copyMessage()}
          aria-label={copied ? "Copied message" : "Copy message"}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-ink-muted transition-colors duration-150 hover:bg-surface hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none"
        >
          {copied ? (
            <CheckIcon className="size-4 text-success" />
          ) : (
            <CopyIcon className="size-4" />
          )}
        </button>
      )}
      {canRegenerate && (
        <button
          type="button"
          onClick={() => onRegenerate(messageId)}
          className="min-h-11 rounded-lg px-3 text-sm text-ink-muted transition-colors duration-150 hover:bg-surface hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none"
        >
          Regenerate response
        </button>
      )}
      {copied && (
        <span role="status" aria-live="polite" className="sr-only">
          Copied
        </span>
      )}
    </div>
  );
}

function textFromMessage(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");
}

export function MessageList({
  messages,
  status,
  error,
  onCopyMessage,
  onRegenerate,
}: MessageListProps) {
  const previousStatusRef = useRef<ChatStatus | null>(null);
  const [statusAnnouncement, setStatusAnnouncement] = useState(
    status === "submitted"
      ? "Assistant is thinking"
      : status === "streaming"
        ? "Assistant is responding"
        : "",
  );
  const latestAssistantId = [...messages]
    .reverse()
    .find((message) => message.role === "assistant")?.id;

  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    if (
      status === "ready" &&
      (previousStatus === "submitted" || previousStatus === "streaming")
    ) {
      setStatusAnnouncement("Response complete");
    } else if (status === "submitted") {
      setStatusAnnouncement("Assistant is thinking");
    } else if (status === "streaming") {
      setStatusAnnouncement("Assistant is responding");
    } else if (status === "error") {
      setStatusAnnouncement("");
    }
    previousStatusRef.current = status;
  }, [status]);

  return (
    <div className="space-y-8">
      {messages.map((message) => {
        const text = textFromMessage(message);

        if (message.role === "user") {
          return (
            <div key={message.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-raised px-4 py-2.5 shadow-lift [overflow-wrap:anywhere] md:max-w-[78%]">
                <p className="whitespace-pre-wrap text-base leading-7 text-ink">
                  {text}
                </p>
              </div>
            </div>
          );
        }

        const canRegenerate =
          message.id === latestAssistantId && status === "ready";

        return (
          <article key={message.id} className="group min-w-0">
            <div className="min-w-0 space-y-3">
              {message.parts.map((part, index) => {
                if (part.type === "text") {
                  return part.text ? (
                    <MarkdownMessage
                      key={`${message.id}-text-${index}`}
                      text={part.text}
                    />
                  ) : null;
                }

                const activity = toolPartToViewModel(part);
                return activity ? (
                  <ToolActivity
                    key={`${message.id}-tool-${activity.id}`}
                    activity={activity}
                  />
                ) : null;
              })}
            </div>
            {(text || canRegenerate) && (
              <MessageActions
                messageId={message.id}
                text={text}
                canRegenerate={canRegenerate}
                onCopyMessage={onCopyMessage}
                onRegenerate={onRegenerate}
              />
            )}
          </article>
        );
      })}

      {status === "submitted" && (
        <div
          data-testid="streaming-indicator"
          className="flex min-h-11 items-center gap-2 text-sm text-ink-muted"
        >
          <span>Thinking</span>
          <span className="flex gap-1" aria-hidden="true">
            <span className="thinking-dot size-1.5 rounded-full bg-ink-secondary" />
            <span className="thinking-dot size-1.5 rounded-full bg-ink-secondary" />
            <span className="thinking-dot size-1.5 rounded-full bg-ink-secondary" />
          </span>
        </div>
      )}

      <span
        data-testid="chat-status-announcement"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {statusAnnouncement}
      </span>
      {error && (
        <span
          data-testid="chat-error-announcement"
          aria-live="assertive"
          aria-atomic="true"
          className="sr-only"
        >
          {error.message}
        </span>
      )}
    </div>
  );
}
