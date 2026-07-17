"use client";

import { useMemo, useState } from "react";
import { PROGRAMS, type AdhocRequest, type Profile, type Task } from "@/lib/types";

type PersonStat = {
  id: string;
  name: string;
  assigned: number;
  completed: number;
  inProgress: number;
  overdue: number;
};

// Common shape so tasks and adhoc are counted the same way.
type WorkItem = {
  assignee_id: string | null;
  assignee: Profile | null | undefined;
  status: string;
  eta: string | null;
  program: string | null;
};

const selCls = "rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm outline-none";

// "2026-07" → "Jul 2026"
function fmtMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}
const openCalendar = (e: React.MouseEvent<HTMLInputElement>) =>
  (e.currentTarget as any).showPicker?.();

export function InsightsView({ tasks, adhoc = [] }: { tasks: Task[]; adhoc?: AdhocRequest[] }) {
  const [program, setProgram] = useState("");
  const [month, setMonth] = useState(""); // YYYY-MM, matched against ETA
  const [etaFrom, setEtaFrom] = useState("");
  const [etaTo, setEtaTo] = useState("");

  const today = useMemo(() => new Date(new Date().toDateString()), []);
  const isOverdue = (i: WorkItem) =>
    !!i.eta && i.status !== "Completed" && new Date(i.eta + "T00:00:00") < today;

  // Tasks + adhoc, normalized into one list.
  const items = useMemo<WorkItem[]>(
    () => [
      ...tasks.map((t) => ({
        assignee_id: t.assignee_id,
        assignee: t.assignee,
        status: t.status,
        eta: t.eta,
        program: t.program,
      })),
      ...adhoc.map((a) => ({
        assignee_id: a.assignee_id,
        assignee: a.assignee,
        status: a.status,
        eta: a.eta,
        program: a.program,
      })),
    ],
    [tasks, adhoc]
  );

  // Distinct ETA months present, newest first — powers the Month dropdown.
  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    for (const i of items) if (i.eta) set.add(i.eta.slice(0, 7));
    return Array.from(set).sort().reverse();
  }, [items]);

  const filtered = useMemo(
    () =>
      items.filter((i) => {
        if (program && i.program !== program) return false;
        if (month && (!i.eta || !i.eta.startsWith(month))) return false;
        if (etaFrom && (!i.eta || i.eta < etaFrom)) return false;
        if (etaTo && (!i.eta || i.eta > etaTo)) return false;
        return true;
      }),
    [items, program, month, etaFrom, etaTo]
  );

  const stats = useMemo(() => {
    const map = new Map<string, PersonStat>();
    for (const i of filtered) {
      if (!i.assignee_id) continue;
      const name = i.assignee?.full_name ?? i.assignee?.email ?? "Unknown";
      const s =
        map.get(i.assignee_id) ??
        { id: i.assignee_id, name, assigned: 0, completed: 0, inProgress: 0, overdue: 0 };
      s.assigned++;
      if (i.status === "Completed") s.completed++;
      else if (i.status === "Working" || i.status === "In Review") s.inProgress++;
      if (isOverdue(i)) s.overdue++;
      map.set(i.assignee_id, s);
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
        <select value={month} onChange={(e) => setMonth(e.target.value)} title="Filter by ETA month" className={selCls}>
          <option value="">Any month</option>
          {monthOptions.map((m) => (
            <option key={m} value={m}>{fmtMonth(m)}</option>
          ))}
        </select>
        <span className="text-sm text-muted">ETA</span>
        <input type="date" value={etaFrom} onChange={(e) => setEtaFrom(e.target.value)} onClick={openCalendar} className={`${selCls} cursor-pointer`} />
        <span className="text-sm text-muted">to</span>
        <input type="date" value={etaTo} onChange={(e) => setEtaTo(e.target.value)} onClick={openCalendar} className={`${selCls} cursor-pointer`} />
        {(program || month || etaFrom || etaTo) && (
          <button
            type="button"
            onClick={() => {
              setProgram("");
              setMonth("");
              setEtaFrom("");
              setEtaTo("");
            }}
            className="text-xs text-accent hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="People active" value={totals.people} />
        <Stat label="Tasks + adhoc" value={totals.assigned} />
        <Stat label="Completed" value={totals.completed} />
        <Stat label="Overdue" value={totals.overdue} tone="danger" />
      </div>

      {/* Per-person */}
      <div className="rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted">
          By person — completed vs assigned (tasks + adhoc)
        </div>
        {stats.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">No assigned tasks in this view.</p>
        ) : (
          <div className="divide-y divide-border">
            {stats.map((s) => {
              const rate = s.assigned ? Math.round((s.completed / s.assigned) * 100) : 0;
              const barWidth = (s.assigned / maxAssigned) * 100; // volume
              const fillWidth = s.assigned ? (s.completed / s.assigned) * 100 : 0; // completion within volume
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
