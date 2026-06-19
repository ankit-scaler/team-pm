"use client";

import { useMemo, useState } from "react";
import { MessageSquare, FileSpreadsheet } from "lucide-react";
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
function isDelayed(t: Task) {
  return t.status === "Completed" && t.eta && t.delivered_date && t.delivered_date > t.eta;
}
const openCalendar = (e: React.MouseEvent<HTMLInputElement>) =>
  (e.currentTarget as any).showPicker?.();

const selCls = "rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm outline-none";

export function TaskTable({
  tasks,
  people,
  allTags = [],
  allMetrics = [],
}: {
  tasks: Task[];
  people: Profile[];
  allTags?: string[];
  allMetrics?: string[];
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState("");
  const [tag, setTag] = useState("");
  const [metric, setMetric] = useState("");
  const [etaFrom, setEtaFrom] = useState("");
  const [etaTo, setEtaTo] = useState("");

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (status && t.status !== status) return false;
      if (priority && t.priority !== priority) return false;
      if (assignee === "unassigned" ? t.assignee_id : assignee && t.assignee_id !== assignee)
        return false;
      if (tag && !t.tags.includes(tag)) return false;
      if (metric && !t.metrics.includes(metric)) return false;
      if (etaFrom && (!t.eta || t.eta < etaFrom)) return false;
      if (etaTo && (!t.eta || t.eta > etaTo)) return false;
      if (q && !t.title.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [tasks, q, status, assignee, priority, tag, metric, etaFrom, etaTo]);

  const anyFilter = q || status || assignee || priority || tag || metric || etaFrom || etaTo;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tasks…"
          className="min-w-[160px] flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selCls}>
          <option value="">All stages</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={selCls}>
          <option value="">Anyone</option>
          <option value="unassigned">Unassigned</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.email}</option>
          ))}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className={selCls}>
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        {allTags.length > 0 && (
          <select value={tag} onChange={(e) => setTag(e.target.value)} className={selCls}>
            <option value="">All tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>#{t}</option>
            ))}
          </select>
        )}
        {allMetrics.length > 0 && (
          <select value={metric} onChange={(e) => setMetric(e.target.value)} className={selCls}>
            <option value="">All metrics</option>
            {allMetrics.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">ETA between</span>
        <input type="date" value={etaFrom} onChange={(e) => setEtaFrom(e.target.value)} onClick={openCalendar} className={`${selCls} cursor-pointer`} />
        <span className="text-muted">and</span>
        <input type="date" value={etaTo} onChange={(e) => setEtaTo(e.target.value)} onClick={openCalendar} className={`${selCls} cursor-pointer`} />
        {anyFilter && (
          <button
            type="button"
            onClick={() => {
              setQ(""); setStatus(""); setAssignee(""); setPriority(""); setTag(""); setMetric(""); setEtaFrom(""); setEtaTo("");
            }}
            className="text-xs text-accent hover:underline"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-muted">{filtered.length} of {tasks.length}</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Task</th>
              <th className="px-4 py-2.5 font-medium">Stage</th>
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
                  No tasks match these filters.
                </td>
              </tr>
            )}
            {filtered.map((t) => (
              <tr key={t.id} className="border-b border-border last:border-0 hover:bg-bg/60">
                <td className="max-w-xs px-4 py-3">
                  <div className="font-semibold text-fg">{t.title}</div>
                  {t.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {t.tags.map((tg) => (
                        <span key={tg} className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                          #{tg}
                        </span>
                      ))}
                    </div>
                  )}
                  {t.metrics.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {t.metrics.map((m) => (
                        <span key={m} className="rounded-full bg-cyan-100 px-1.5 py-0.5 text-[11px] font-medium text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">
                          {m}
                        </span>
                      ))}
                    </div>
                  )}
                  {(t.slack_link || t.sheet_link) && (
                    <div className="mt-1 flex items-center gap-3">
                      {t.slack_link && (
                        <a href={t.slack_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline">
                          <MessageSquare size={12} /> Slack
                        </a>
                      )}
                      {t.sheet_link && (
                        <a href={t.sheet_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline">
                          <FileSpreadsheet size={12} /> Sheet
                        </a>
                      )}
                    </div>
                  )}
                  {t.stakeholders && t.stakeholders.length > 0 && (
                    <div className="mt-0.5 truncate text-xs text-muted">
                      {t.stakeholders.map((s) => s.full_name ?? s.email).join(", ")}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                <td className="px-4 py-3">
                  {t.assignee ? (
                    <span className="text-sm" title={t.assignee.email}>{t.assignee.full_name ?? t.assignee.email}</span>
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
                <td className="px-4 py-3 text-muted">
                  {fmt(t.delivered_date)}
                  {isDelayed(t) && (
                    <span className="ml-1.5 inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[11px] font-bold text-red-700 dark:bg-red-950 dark:text-red-300">
                      Delayed
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <TaskForm people={people} task={t} allTags={allTags} allMetrics={allMetrics} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
