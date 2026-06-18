"use client";

import { useMemo, useState } from "react";
import { TaskForm } from "./task-form";
import { StatusBadge, PriorityLabel, EffortChip } from "./status-badge";
import { STATUSES, PRIORITIES, type Profile, type Task } from "@/lib/types";

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
function isOverdue(t: Task) {
  return t.eta && t.status !== "Completed" && new Date(t.eta) < new Date(new Date().toDateString());
}

const selCls = "rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm outline-none";

export function TaskTable({ tasks, people }: { tasks: Task[]; people: Profile[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState("");

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (status && t.status !== status) return false;
      if (priority && t.priority !== priority) return false;
      if (assignee === "unassigned" ? t.assignee_id : assignee && t.assignee_id !== assignee)
        return false;
      if (q && !t.title.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [tasks, q, status, assignee, priority]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tasks…"
          className="min-w-[180px] flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selCls}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className={selCls}>
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={selCls}>
          <option value="">Anyone</option>
          <option value="unassigned">Unassigned</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Task</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Assignee</th>
              <th className="px-4 py-2.5 font-medium">Priority</th>
              <th className="px-4 py-2.5 font-medium">Effort</th>
              <th className="px-4 py-2.5 font-medium">ETA</th>
              <th className="px-4 py-2.5 font-medium">Delivered</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted">
                  No tasks match these filters. Create one to get started.
                </td>
              </tr>
            )}
            {filtered.map((t) => (
              <tr key={t.id} className="border-b border-border last:border-0 hover:bg-bg/60">
                <td className="max-w-xs px-4 py-3">
                  <div className="font-medium">{t.title}</div>
                  {t.stakeholders && t.stakeholders.length > 0 && (
                    <div className="mt-0.5 truncate text-xs text-muted">
                      {t.stakeholders.map((s) => s.full_name ?? s.email).join(", ")}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                <td className="px-4 py-3">
                  {t.assignee ? (
                    <span className="text-sm">{t.assignee.full_name ?? t.assignee.email}</span>
                  ) : (
                    <span className="text-xs text-muted">Unassigned</span>
                  )}
                </td>
                <td className="px-4 py-3"><PriorityLabel priority={t.priority} /></td>
                <td className="px-4 py-3"><EffortChip effort={t.effort} /></td>
                <td className={`px-4 py-3 ${isOverdue(t) ? "font-medium text-red-600 dark:text-red-400" : ""}`}>
                  {fmt(t.eta)}
                  {isOverdue(t) && <span className="ml-1 text-[11px]">overdue</span>}
                </td>
                <td className="px-4 py-3 text-muted">{fmt(t.delivered_date)}</td>
                <td className="px-4 py-3 text-right">
                  <TaskForm people={people} task={t} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
