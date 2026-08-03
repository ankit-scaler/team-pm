"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import type { Task } from "@/lib/types";

// Every field the user can choose to include in the CSV. `get` turns a task into
// a plain string cell. `on` marks the ones checked by default.
type Field = { key: string; label: string; get: (t: Task) => string; on?: boolean };
const FIELDS: Field[] = [
  { key: "completed_date", label: "Completed date", get: (t) => t.delivered_date ?? "", on: true },
  { key: "title", label: "Task name", get: (t) => t.title ?? "", on: true },
  { key: "description", label: "Description", get: (t) => t.description ?? "", on: true },
  { key: "slack_link", label: "Slack link", get: (t) => t.slack_link ?? "", on: true },
  { key: "sheet_link", label: "Sheet link", get: (t) => t.sheet_link ?? "", on: true },
  { key: "assignee", label: "Assignee", get: (t) => t.assignee?.full_name ?? t.assignee?.email ?? "" },
  { key: "program", label: "Program", get: (t) => t.program ?? "" },
  { key: "track", label: "Track", get: (t) => t.track ?? "" },
  { key: "eta", label: "ETA", get: (t) => t.eta ?? "" },
  { key: "priority", label: "Priority", get: (t) => t.priority ?? "" },
  { key: "effort", label: "Effort", get: (t) => t.effort ?? "" },
  { key: "tags", label: "Tags", get: (t) => (t.tags ?? []).join(", ") },
  { key: "metrics", label: "Metrics", get: (t) => (t.metrics ?? []).join(", ") },
  {
    key: "stakeholders",
    label: "Stakeholders",
    get: (t) => (t.stakeholders ?? []).map((s) => s.full_name ?? s.email).join(", "),
  },
];

// RFC-4180 cell: quote when it contains a comma, quote, or newline; double inner quotes.
const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function ExportCompleted({ tasks }: { tasks: Task[] }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(FIELDS.filter((f) => f.on).map((f) => f.key))
  );

  const completed = useMemo(() => tasks.filter((t) => t.status === "Completed"), [tasks]);
  const toggle = (key: string) =>
    setPicked((s) => {
      const n = new Set(s);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

  function download() {
    const cols = FIELDS.filter((f) => picked.has(f.key));
    if (cols.length === 0 || completed.length === 0) return;

    const header = cols.map((c) => esc(c.label)).join(",");
    const body = completed.map((t) => cols.map((c) => esc(c.get(t))).join(",")).join("\n");
    // Prepend a BOM so Excel opens UTF-8 correctly.
    const csv = "﻿" + header + "\n" + body;

    const stamp = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `completed-tasks-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setOpen(false);
  }

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-fg transition-colors hover:border-border-strong"
      >
        <Download size={15} /> Download completed
      </button>

      {open && (
        <>
          {/* click-away backdrop */}
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-30 mt-1 w-64 rounded-xl border border-border bg-surface p-3 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-fg">Columns to include</span>
              <span className="text-[11px] text-muted">{completed.length} completed</span>
            </div>

            <div className="max-h-56 space-y-0.5 overflow-y-auto">
              {FIELDS.map((f) => (
                <label
                  key={f.key}
                  className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-bg"
                >
                  <input type="checkbox" checked={picked.has(f.key)} onChange={() => toggle(f.key)} />
                  {f.label}
                </label>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPicked(new Set(FIELDS.map((f) => f.key)))}
                className="text-[11px] text-accent hover:underline"
              >
                Select all
              </button>
              <button
                type="button"
                disabled={picked.size === 0 || completed.length === 0}
                onClick={download}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                <Download size={13} /> Download CSV
              </button>
            </div>
            {completed.length === 0 && (
              <p className="mt-2 text-[11px] text-muted">No completed tasks to export.</p>
            )}
          </div>
        </>
      )}
    </span>
  );
}
