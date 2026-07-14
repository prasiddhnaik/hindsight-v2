"use client";

import { useEffect, useState } from "react";

import { classifyChatError } from "~/app/_components/chat-error";
import { AlertIcon, RefreshIcon } from "~/app/_components/icons";

interface ChatFeedbackProps {
  message: string | null;
  online: boolean;
  onRetry?: () => void;
}

const OFFLINE_MESSAGE = "You're offline. Reconnect to continue.";

export function ChatFeedback({
  message,
  online,
  onRetry,
}: ChatFeedbackProps) {
  const kind = classifyChatError(message ?? "", online);
  const [seconds, setSeconds] = useState(60);

  useEffect(() => {
    if (kind !== "rate-limit") {
      setSeconds(60);
      return;
    }

    setSeconds(60);
    const interval = window.setInterval(() => {
      setSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          return 0;
        }
        return current - 1;
      });
    }, 1_000);

    return () => window.clearInterval(interval);
  }, [kind]);

  if (online && !message) return null;

  const visibleMessage = kind === "offline" ? OFFLINE_MESSAGE : message;
  const canRetry =
    onRetry !== undefined &&
    (kind === "provider" || kind === "unknown" || kind === "rate-limit");
  const retryDisabled = kind === "rate-limit" && seconds > 0;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-start gap-3 rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-base text-danger"
    >
      <AlertIcon className="mt-1 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p>{visibleMessage}</p>
        {canRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={retryDisabled}
            aria-label={
              retryDisabled ? `Retry in ${seconds} seconds` : "Retry"
            }
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-danger/40 px-4 font-medium tabular-nums transition-colors hover:bg-danger/10 focus-visible:ring-2 focus-visible:ring-danger/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshIcon className="size-4" />
            {retryDisabled ? `Retry in ${seconds}s` : "Retry"}
          </button>
        )}
      </div>
    </div>
  );
}
