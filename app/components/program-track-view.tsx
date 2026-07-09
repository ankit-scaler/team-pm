"use client";

import { useMemo, useState } from "react";
import { StatusBadge, PriorityLabel, EffortChip } from "./status-badge";
import { TaskForm } from "./task-form";
import { PROGRAMS, TRACKS, STATUSES, type Profile, type Task } from "@/lib/types";

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
const openCal = (e: React.MouseEvent<HTMLInputElement>) =>
  (e.currentTarget as any).showPicker?.();

const selCls = "rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm outline-none";

export function ProgramTrackView({
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
  const [program, setProgram] = useState("");
  const [track, setTrack] = useState("");
  const [status, setStatus] = useState("");
  const [etaFrom, setEtaFrom] = useState("");
  const [etaTo, setEtaTo] = useState("");

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (program && t.program !== program) return false;
      if (track && t.track !== track) return false;
      if (status && t.status !== status) return false;
      if (etaFrom && (!t.eta || t.eta < etaFrom)) return false;
      if (etaTo && (!t.eta || t.eta > etaTo)) return false;
      return true;
    });
  }, [tasks, program, track, status, etaFrom, etaTo]);

  const anyFilter = program || track || status || etaFrom || etaTo;

  // Count summary
  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of STATUSES) counts[s] = filtered.filter((t) => t.status === s).length;
    return counts;
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={program} onChange={(e) => setProgram(e.target.value)} className={selCls}>
          <option value="">All programs</option>
          {PROGRAMS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select value={track} onChange={(e) => setTrack(e.target.value)} className={selCls}>
          <option value="">All tracks</option>
          {TRACKS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selCls}>
          <option value="">All stages</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">ETA between</span>
        <input type="date" value={etaFrom} onChange={(e) => setEtaFrom(e.target.value)} onClick={openCal} className={`${selCls} cursor-pointer`} />
        <span className="text-muted">and</span>
        <input type="date" value={etaTo} onChange={(e) => setEtaTo(e.target.value)} onClick={openCal} className={`${selCls} cursor-pointer`} />
        {anyFilter && (
          <button
            type="button"
            onClick={() => {
              setProgram(""); setTrack(""); setStatus(""); setEtaFrom(""); setEtaTo("");
            }}
            className="text-xs text-accent hover:underline"
          >
            Clear
          </button>
        )}
        <span className="ml-auto text-xs text-muted">{filtered.length} tasks</span>
      </div>

      {/* Status summary strip */}
      <div className="flex flex-wrap gap-3">
        {STATUSES.map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <StatusBadge status={s} />
            <span className="text-sm font-bold">{summary[s]}</span>
          </div>
        ))}
      </div>

      {/* Results table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Task</th>
              <th className="px-4 py-2.5 font-medium">Program</th>
              <th className="px-4 py-2.5 font-medium">Track</th>
              <th className="px-4 py-2.5 font-medium">Stage</th>
              <th className="px-4 py-2.5 font-medium">Assignee</th>
              <th className="px-4 py-2.5 font-medium">Priority</th>
              <th className="px-4 py-2.5 font-medium">ETA</th>
              <th className="px-4 py-2.5 font-medium">Delivered</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-muted">
                  No tasks match this program/track combination.
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
                </td>
                <td className="px-4 py-3">
                  {t.program ? (
                    <span className="rounded bg-pink-100 px-1.5 py-0.5 text-xs font-medium text-pink-700 dark:bg-pink-950 dark:text-pink-300">{t.program}</span>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {t.track ? (
                    <span className="rounded bg-teal-100 px-1.5 py-0.5 text-xs font-medium text-teal-700 dark:bg-teal-950 dark:text-teal-300">{t.track}</span>
                  ) : (
                    <span className="text-xs text-muted">—</span>
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
