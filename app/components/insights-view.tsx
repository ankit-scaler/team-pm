"use client";

import { useMemo, useState } from "react";
import { PROGRAMS, type Task } from "@/lib/types";

type PersonStat = {
  id: string;
  name: string;
  assigned: number;
  completed: number;
  inProgress: number;
  overdue: number;
  totalDays: number;
  doneWithDays: number;
};

const selCls = "rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm outline-none";

export function InsightsView({ tasks }: { tasks: Task[] }) {
  const [program, setProgram] = useState("");

  const today = useMemo(() => new Date(new Date().toDateString()), []);
  const isOverdue = (t: Task) =>
    !!t.eta && t.status !== "Completed" && new Date(t.eta) < today;

  const filtered = useMemo(
    () => (program ? tasks.filter((t) => t.program === program) : tasks),
    [tasks, program]
  );

  const stats = useMemo(() => {
    const map = new Map<string, PersonStat>();
    for (const t of filtered) {
      if (!t.assignee_id) continue;
      const name = t.assignee?.full_name ?? t.assignee?.email ?? "Unknown";
      const s =
        map.get(t.assignee_id) ??
        { id: t.assignee_id, name, assigned: 0, completed: 0, inProgress: 0, overdue: 0, totalDays: 0, doneWithDays: 0 };
      s.assigned++;
      if (t.status === "Completed") {
        s.completed++;
        if (t.picked_date && t.delivered_date) {
          const days =
            (new Date(t.delivered_date).getTime() - new Date(t.picked_date).getTime()) / 86_400_000;
          if (days >= 0) {
            s.totalDays += days;
            s.doneWithDays++;
          }
        }
      } else if (t.status === "Working" || t.status === "In Review") {
        s.inProgress++;
      }
      if (isOverdue(t)) s.overdue++;
      map.set(t.assignee_id, s);
    }
    return Array.from(map.values()).sort((a, b) => b.completed - a.completed || b.assigned - a.assigned);
  }, [filtered, today]);

  const totals = useMemo(
    () => ({
      people: stats.length,
      assigned: filtered.length,
      completed: filtered.filter((t) => t.status === "Completed").length,
      overdue: filtered.filter(isOverdue).length,
    }),
    [filtered, stats, today]
  );

  const maxAssigned = Math.max(1, ...stats.map((s) => s.assigned));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={program} onChange={(e) => setProgram(e.target.value)} className={selCls}>
          <option value="">All programs</option>
          {PROGRAMS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        {program && (
          <button type="button" onClick={() => setProgram("")} className="text-xs text-accent hover:underline">
            Clear
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="People active" value={totals.people} />
        <Stat label="Tasks" value={totals.assigned} />
        <Stat label="Completed" value={totals.completed} />
        <Stat label="Overdue" value={totals.overdue} tone="danger" />
      </div>

      {/* Per-person */}
      <div className="rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted">
          By person — completed vs assigned
        </div>
        {stats.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">No assigned tasks in this view.</p>
        ) : (
          <div className="divide-y divide-border">
            {stats.map((s) => {
              const rate = s.assigned ? Math.round((s.completed / s.assigned) * 100) : 0;
              const barWidth = (s.assigned / maxAssigned) * 100; // volume
              const fillWidth = s.assigned ? (s.completed / s.assigned) * 100 : 0; // completion within volume
              const avg = s.doneWithDays ? (s.totalDays / s.doneWithDays).toFixed(1) : "—";
              return (
                <div key={s.id} className="px-4 py-3">
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <span className="text-[13px] font-semibold text-fg">{s.name}</span>
                    <span className="text-xs text-muted">
                      {s.completed}/{s.assigned} done · {rate}%
                      {s.inProgress > 0 && ` · ${s.inProgress} in progress`}
                      {s.overdue > 0 && (
                        <span className="text-red-600 dark:text-red-400"> · {s.overdue} overdue</span>
                      )}
                      {avg !== "—" && ` · avg ${avg}d`}
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
                    {/* volume track */}
                    <div className="h-full rounded-full bg-accent/20" style={{ width: `${barWidth}%` }}>
                      {/* completed portion */}
                      <div className="h-full rounded-full bg-accent" style={{ width: `${fillWidth}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "danger" }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div
        className={`text-2xl font-bold tracking-tight ${
          tone === "danger" && value > 0 ? "text-red-600 dark:text-red-400" : "text-fg"
        }`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}
