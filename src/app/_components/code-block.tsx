"use client";

import { useEffect, useRef, useState } from "react";

import { CheckIcon, CopyIcon } from "~/app/_components/icons";

interface CodeBlockProps {
  code: string;
  language?: string;
}

const LANGUAGE_NAMES: Record<string, string> = {
  bash: "Shell",
  css: "CSS",
  html: "HTML",
  javascript: "JavaScript",
  js: "JavaScript",
  json: "JSON",
  jsx: "JSX",
  markdown: "Markdown",
  md: "Markdown",
  shell: "Shell",
  sh: "Shell",
  ts: "TypeScript",
  tsx: "TSX",
  typescript: "TypeScript",
};

function languageLabel(language?: string) {
  if (!language) return null;
  const normalized = language.trim().toLowerCase();
  return LANGUAGE_NAMES[normalized] ?? normalized.toUpperCase();
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const label = languageLabel(language);

  useEffect(
    () => () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    },
    [],
  );

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="my-5 min-w-0 overflow-hidden rounded-xl border border-hairline bg-surface">
      <div className="flex min-h-11 items-center justify-between gap-3 border-b border-hairline pl-4">
        <span className="font-mono text-xs text-ink-muted">{label}</span>
        <button
          type="button"
          onClick={() => void copyCode()}
          aria-label={copied ? "Copied code" : "Copy code"}
          className="flex size-11 shrink-0 items-center justify-center text-ink-muted transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none"
        >
          {copied ? (
            <CheckIcon className="size-4 text-success" />
          ) : (
            <CopyIcon className="size-4" />
          )}
        </button>
      </div>
      <pre
        data-testid="code-scroll-region"
        className="overflow-x-auto px-4 py-3 font-mono text-sm leading-6"
      >
        <code>{code}</code>
      </pre>
      {copied && (
        <span role="status" aria-live="polite" className="sr-only">
          Copied
        </span>
      )}
    </div>
  );
}
