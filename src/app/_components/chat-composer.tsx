"use client";

import { useId, useLayoutEffect, useRef } from "react";

import { ArrowUpIcon, StopIcon } from "~/app/_components/icons";

export interface ChatComposerProps {
  value: string;
  busy: boolean;
  offline: boolean;
  onChange(value: string): void;
  onSubmit(): void;
  onStop(): void;
}

const MAX_HEIGHT = 200;

export function ChatComposer({
  value,
  busy,
  offline,
  onChange,
  onSubmit,
  onStop,
}: ChatComposerProps) {
  const helpId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSubmit = value.trim() !== "" && !offline;

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const height = Math.min(textarea.scrollHeight, MAX_HEIGHT);
    textarea.style.height = `${height}px`;
    textarea.style.overflowY = textarea.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
  }, [value]);

  function submit() {
    if (!busy && canSubmit) onSubmit();
  }

  return (
    <div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="rounded-2xl border border-hairline bg-surface transition-colors duration-200 focus-within:border-accent/50"
      >
        <div className="flex items-end gap-2 p-2 pl-4">
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key !== "Enter" ||
                event.shiftKey ||
                event.nativeEvent.isComposing
              ) {
                return;
              }
              event.preventDefault();
              submit();
            }}
            placeholder="Message Hindsight…"
            aria-label="Message Hindsight"
            aria-describedby={helpId}
            className="min-h-11 min-w-0 flex-1 resize-none bg-transparent py-2 text-base leading-7 outline-none placeholder:text-ink-muted"
          />
          {busy ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop generating"
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-bg transition-all duration-150 hover:brightness-110 active:scale-95 focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none"
            >
              <StopIcon className="size-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSubmit}
              aria-label="Send message"
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-bg transition-all duration-150 hover:brightness-110 active:scale-95 focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-raised disabled:text-ink-muted"
            >
              <ArrowUpIcon className="size-4" />
            </button>
          )}
        </div>
      </form>
      <p
        id={helpId}
        className="mt-2 text-center text-base text-ink-muted md:text-xs"
      >
        Enter to send · Shift+Enter for new line
      </p>
      {offline && (
        <p
          role="status"
          className="mt-2 text-center text-base text-danger md:text-sm"
        >
          You&apos;re offline. Reconnect to send messages.
        </p>
      )}
    </div>
  );
}
