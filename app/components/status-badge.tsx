import {
  STATUS_STYLES,
  PRIORITY_STYLES,
  EFFORT_STYLES,
  type Status,
  type Priority,
  type Effort,
} from "@/lib/types";

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

export function PriorityLabel({ priority }: { priority: Priority }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${PRIORITY_STYLES[priority]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {priority}
    </span>
  );
}

export function EffortChip({ effort }: { effort: Effort | null }) {
  if (!effort) return <span className="text-xs text-muted">—</span>;
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${EFFORT_STYLES[effort]}`}>
      {effort}
    </span>
  );
}
