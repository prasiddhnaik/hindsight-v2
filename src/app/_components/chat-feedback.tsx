"use client";

import { useEffect, useState } from "react";

import { classifyChatError } from "~/app/_components/chat-error";
import { AlertIcon, RefreshIcon } from "~/app/_components/icons";

interface ChatFeedbackProps {
  message: string | null;
  online: boolean;
  rateLimitDeadline: number | null;
  onRetry?: () => void;
}

const OFFLINE_MESSAGE = "You're offline. Reconnect to continue.";

export function ChatFeedback({
  message,
  online,
  rateLimitDeadline,
  onRetry,
}: ChatFeedbackProps) {
  const kind = classifyChatError(message ?? "", online);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (rateLimitDeadline === null) return;

    const interval = window.setInterval(() => {
      setTick((current) => current + 1);
      if (Date.now() >= rateLimitDeadline) window.clearInterval(interval);
    }, 1_000);

    return () => window.clearInterval(interval);
  }, [rateLimitDeadline]);

  if (online && !message) return null;

  const visibleMessage = kind === "offline" ? OFFLINE_MESSAGE : message;
  const canRetry =
    onRetry !== undefined &&
    (kind === "provider" || kind === "unknown" || kind === "rate-limit");
  const seconds =
    rateLimitDeadline === null
      ? 0
      : Math.max(0, Math.ceil((rateLimitDeadline - Date.now()) / 1_000));
  const retryDisabled = kind === "rate-limit" && seconds > 0;

  return (
    <div
      className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-base text-danger"
    >
      <div role="alert" aria-live="assertive" className="flex items-start gap-3">
        <AlertIcon className="mt-1 size-4 shrink-0" />
        <p>{visibleMessage}</p>
      </div>
      {canRetry && (
        <div aria-live="off" className="pl-7">
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
        </div>
      )}
    </div>
  );
}
