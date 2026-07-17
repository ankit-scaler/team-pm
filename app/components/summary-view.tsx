"use client";

import { useMemo, useState } from "react";
import { PROGRAMS, type AdhocRequest, type Profile, type Task } from "@/lib/types";

type Item = { kind: "task" | "adhoc"; id: string; title: string; metrics: string[] };
type PersonRow = {
  id: string;
  name: string;
  email: string;
  tasks: number;
  adhoc: number;
  items: Item[];
  metricCounts: Record<string, number>;
};

const selCls = "rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm outline-none";

// Admin-only: pick a program → see who worked on it (assignee OR stakeholder for
// tasks; assignee for adhoc), the items they touched, and a per-metric tally.
export function SummaryView({ tasks, adhoc }: { tasks: Task[]; adhoc: AdhocRequest[] }) {
  const [program, setProgram] = useState<string>(PROGRAMS[0]);

  const rows = useMemo(() => {
    const map = new Map<string, PersonRow>();
    const bump = (p: Profile | null | undefined, item: Item) => {
      if (!p) return;
      const row =
        map.get(p.id) ??
        { id: p.id, name: p.full_name ?? p.email, email: p.email, tasks: 0, adhoc: 0, items: [], metricCounts: {} };
      row.items.push(item);
      if (item.kind === "task") row.tasks++;
      else row.adhoc++;
      for (const m of item.metrics) row.metricCounts[m] = (row.metricCounts[m] ?? 0) + 1;
      map.set(p.id, row);
    };

    for (const t of tasks) {
      if (t.program !== program) continue;
      const item: Item = { kind: "task", id: t.id, title: t.title, metrics: t.metrics ?? [] };
      bump(t.assignee, item);
      for (const s of t.stakeholders ?? []) if (s.id !== t.assignee_id) bump(s, item);
    }
    for (const a of adhoc) {
      if (a.program !== program) continue;
      const item: Item = {
        kind: "adhoc",
        id: a.id,
        title: a.title || a.module || "Adhoc request",
        metrics: a.metrics ?? [],
      };
      bump(a.assignee, item);
    }

    return Array.from(map.values()).sort(
      (x, y) => y.items.length - x.items.length || x.name.localeCompare(y.name)
    );
  }, [tasks, adhoc, program]);

  const totalMetrics = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of rows) for (const [k, v] of Object.entries(r.metricCounts)) m[k] = (m[k] ?? 0) + v;
    return m;
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">Program</span>
        <select value={program} onChange={(e) => setProgram(e.target.value)} className={selCls}>
          {PROGRAMS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <span className="ml-auto text-xs text-muted">
          {rows.length} {rows.length === 1 ? "person" : "people"}
        </span>
      </div>

      {/* Program-wide metric tally */}
      {Object.keys(totalMetrics).length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            {program} — metrics worked on
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(totalMetrics)
              .sort((a, b) => b[1] - a[1])
              .map(([m, c]) => (
                <MetricChip key={m} metric={m} count={c} />
              ))}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-sm text-muted">
          No one has worked on {program} yet.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[13px] font-semibold text-fg">{r.name}</div>
                  <div className="text-xs text-muted">
                    {r.tasks} task{r.tasks === 1 ? "" : "s"} · {r.adhoc} adhoc
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {Object.entries(r.metricCounts).length === 0 ? (
                    <span className="text-xs text-muted">No metrics</span>
                  ) : (
                    Object.entries(r.metricCounts)
                      .sort((a, b) => b[1] - a[1])
                      .map(([m, c]) => <MetricChip key={m} metric={m} count={c} />)
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-2.5">
                {r.items.map((it) => (
                  <span
                    key={`${it.kind}-${it.id}`}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[11px] text-fg/80"
                    title={it.metrics.join(", ")}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${it.kind === "task" ? "bg-accent" : "bg-pink-500"}`} />
                    {it.title}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricChip({ metric, count }: { metric: string; count: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[11px] font-medium text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/50 dark:text-cyan-300">
      {metric}
      <span className="rounded bg-cyan-200/70 px-1 text-[10px] font-bold text-cyan-900 dark:bg-cyan-800/60 dark:text-cyan-200">
        ×{count}
      </span>
    </span>
  );
}
