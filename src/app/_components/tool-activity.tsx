import {
  getToolName,
  isToolUIPart,
  type UIDataTypes,
  type UIMessagePart,
  type UITools,
} from "ai";

import { WrenchIcon } from "~/app/_components/icons";

export interface ToolActivityViewModel {
  id: string;
  name: string;
  status: "running" | "complete" | "failed";
  input: unknown;
  output?: unknown;
  errorText?: string;
}

function humanizeToolName(name: string) {
  const words = name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\bdate time\b/g, "date & time");

  return words ? words[0]!.toUpperCase() + words.slice(1) : "Tool";
}

export function toolPartToViewModel(
  part: UIMessagePart<UIDataTypes, UITools>,
): ToolActivityViewModel | null {
  if (!isToolUIPart(part)) return null;

  const base: ToolActivityViewModel = {
    id: part.toolCallId,
    name: humanizeToolName(getToolName(part)),
    status:
      part.state === "output-available"
        ? "complete"
        : part.state === "output-error" || part.state === "output-denied"
          ? "failed"
          : "running",
    input: part.input,
  };

  if (part.state === "output-available") {
    return { ...base, output: part.output };
  }

  if (part.state === "output-error") {
    return { ...base, errorText: part.errorText };
  }

  if (part.state === "output-denied") {
    return { ...base, errorText: part.approval.reason ?? "Tool use denied" };
  }

  return base;
}

interface ToolActivityProps {
  activity: ToolActivityViewModel;
}

const STATUS_LABELS = {
  running: "Running",
  complete: "Complete",
  failed: "Failed",
} as const;

function prettyValue(value: unknown) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function ActivityHeading({ activity }: ToolActivityProps) {
  const statusTone =
    activity.status === "failed"
      ? "text-danger"
      : activity.status === "complete"
        ? "text-success"
        : "text-ink-muted";

  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <WrenchIcon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-sm text-ink-secondary">
        {activity.name}
      </span>
      <span className={`shrink-0 text-xs ${statusTone}`}>
        {STATUS_LABELS[activity.status]}
      </span>
    </span>
  );
}

export function ToolActivity({ activity }: ToolActivityProps) {
  const hasContent =
    activity.input !== undefined ||
    activity.output !== undefined ||
    activity.errorText !== undefined;

  if (!hasContent) {
    return (
      <div
        aria-label={`${activity.name} tool activity, ${STATUS_LABELS[activity.status]}`}
        className="flex min-h-11 items-center rounded-lg border border-hairline bg-surface px-3"
      >
        <ActivityHeading activity={activity} />
      </div>
    );
  }

  return (
    <details
      aria-label={`${activity.name} tool activity, ${STATUS_LABELS[activity.status]}`}
      className="min-w-0 overflow-hidden rounded-lg border border-hairline bg-surface"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center px-3 focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none">
        <ActivityHeading activity={activity} />
      </summary>
      <div className="min-w-0 border-t border-hairline px-3 py-3">
        {activity.input !== undefined && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-muted">Input</p>
            <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs leading-5 text-ink-secondary">
              {prettyValue(activity.input)}
            </pre>
          </div>
        )}
        {activity.output !== undefined && (
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-medium text-ink-muted">Output</p>
            <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs leading-5 text-ink-secondary">
              {prettyValue(activity.output)}
            </pre>
          </div>
        )}
        {activity.errorText && (
          <p className="mt-3 break-words text-sm text-danger">
            {activity.errorText}
          </p>
        )}
      </div>
    </details>
  );
}
