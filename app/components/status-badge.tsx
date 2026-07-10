import {
  type Status,
  type Priority,
  type Effort,
} from "@/lib/types";

// ─── Unified design language ────────────────────────────────
// The idea: chips look consistent. Semantic color lives in a small dot,
// not in loud backgrounds. This makes many chips readable side by side.

const STATUS_DOT: Record<Status, string> = {
  "To pick": "bg-slate-400",
  Working: "bg-blue-500",
  "In Review": "bg-amber-500",
  Completed: "bg-emerald-500",
};

const STATUS_TEXT: Record<Status, string> = {
  "To pick": "text-slate-700 dark:text-slate-300",
  Working: "text-blue-700 dark:text-blue-300",
  "In Review": "text-amber-700 dark:text-amber-300",
  Completed: "text-emerald-700 dark:text-emerald-300",
};

const PRIORITY_DOT: Record<Priority, string> = {
  Low: "bg-slate-400",
  Medium: "bg-blue-500",
  High: "bg-orange-500",
  Urgent: "bg-red-500",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-0.5 text-xs font-semibold ${STATUS_TEXT[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {status}
    </span>
  );
}

export function PriorityLabel({ priority }: { priority: Priority }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-fg/80">
      <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[priority]}`} />
      {priority}
    </span>
  );
}

export function EffortChip({ effort }: { effort: Effort | null }) {
  if (!effort) return null;
  return (
    <span className="text-xs font-medium text-fg/80">
      {effort} effort
    </span>
  );
}
