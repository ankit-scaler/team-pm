"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { StatusBadge } from "./status-badge";
import { PROGRAMS, type AdhocRequest, type Profile, type Status, type Task } from "@/lib/types";

type Item = {
  kind: "task" | "adhoc";
  id: string;
  title: string;
  metrics: string[];
  stakeholders: string[];
  status: Status;
  eta: string | null;
};
type PersonRow = {
  id: string;
  name: string;
  email: string;
  tasks: number;
  adhoc: number;
  items: Item[];
  metricCounts: Record<string, number>;
  stakeholders: string[];
};

const selCls = "rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm outline-none";

// Synthetic row id for items that have no assignee — keeps them visible and
// keeps the metric totals honest, without counting as a real "person".
const UNASSIGNED_ID = "__unassigned__";
// Sentinel metric for items that carry no metric, so they stay reachable in the
// drill-down (otherwise a person's task/adhoc counts wouldn't reconcile).
const NO_METRIC = "__no_metric__";

// "2026-07" → "Jul 2026"
function fmtMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}
// "2026-07-20" → "Jul 20"
function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
const openCalendar = (e: React.MouseEvent<HTMLInputElement>) =>
  (e.currentTarget as any).showPicker?.();

// Admin-only. A drill-down to keep things uncluttered:
//   program (+ date filters) → people → a person's metrics → the items for a metric.
export function SummaryView({ tasks, adhoc }: { tasks: Task[]; adhoc: AdhocRequest[] }) {
  const [program, setProgram] = useState<string>(PROGRAMS[0]);
  const [month, setMonth] = useState(""); // YYYY-MM, matched against ETA
  const [etaFrom, setEtaFrom] = useState("");
  const [etaTo, setEtaTo] = useState("");

  // Drill-down selection.
  const [personId, setPersonId] = useState<string | null>(null);
  const [metric, setMetric] = useState<string | null>(null);

  // Distinct ETA months across tasks + adhoc, newest first.
  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of tasks) if (t.eta) set.add(t.eta.slice(0, 7));
    for (const a of adhoc) if (a.eta) set.add(a.eta.slice(0, 7));
    return Array.from(set).sort().reverse();
  }, [tasks, adhoc]);

  const rows = useMemo(() => {
    // An item passes the date filter if its ETA is in the chosen month / range.
    const matchesDate = (eta: string | null) => {
      if (month && (!eta || !eta.startsWith(month))) return false;
      if (etaFrom && (!eta || eta < etaFrom)) return false;
      if (etaTo && (!eta || eta > etaTo)) return false;
      return true;
    };
    const map = new Map<string, PersonRow>();
    // Count each item exactly ONCE — on its assignee. Stakeholders are recorded
    // on that same row for display only (not counted), so the per-person metric
    // tallies always sum to the program total.
    const bump = (p: Profile | null | undefined, item: Item) => {
      const id = p?.id ?? UNASSIGNED_ID;
      const name = p ? p.full_name ?? p.email : "Unassigned";
      const row =
        map.get(id) ??
        { id, name, email: p?.email ?? "", tasks: 0, adhoc: 0, items: [], metricCounts: {}, stakeholders: [] };
      row.items.push(item);
      if (item.kind === "task") row.tasks++;
      else row.adhoc++;
      for (const m of item.metrics) row.metricCounts[m] = (row.metricCounts[m] ?? 0) + 1;
      for (const s of item.stakeholders)
        if (s !== row.name && !row.stakeholders.includes(s)) row.stakeholders.push(s);
      map.set(id, row);
    };

    for (const t of tasks) {
      if (t.program !== program) continue;
      if (!matchesDate(t.eta)) continue;
      const stakeholders = (t.stakeholders ?? [])
        .map((s) => s.full_name ?? s.email)
        .filter((n): n is string => Boolean(n));
      const item: Item = {
        kind: "task",
        id: t.id,
        title: t.title,
        metrics: t.metrics ?? [],
        stakeholders,
        status: t.status,
        eta: t.eta,
      };
      bump(t.assignee, item);
    }
    for (const a of adhoc) {
      if (a.program !== program) continue;
      if (!matchesDate(a.eta)) continue;
      const item: Item = {
        kind: "adhoc",
        id: a.id,
        title: a.title || a.module || "Adhoc request",
        metrics: a.metrics ?? [],
        stakeholders: a.stakeholder ? [a.stakeholder] : [],
        status: a.status,
        eta: a.eta,
      };
      bump(a.assignee, item);
    }

    return Array.from(map.values()).sort((x, y) => {
      // Unassigned always sinks to the bottom, whatever its count.
      if (x.id === UNASSIGNED_ID) return 1;
      if (y.id === UNASSIGNED_ID) return -1;
      return y.items.length - x.items.length || x.name.localeCompare(y.name);
    });
  }, [tasks, adhoc, program, month, etaFrom, etaTo]);

  // "N people" excludes the synthetic Unassigned bucket.
  const peopleCount = rows.filter((r) => r.id !== UNASSIGNED_ID).length;

  // Resolve the current drill-down from state (guarded, so stale ids after a
  // filter change simply fall back to the level above).
  const person = personId ? rows.find((r) => r.id === personId) ?? null : null;
  const noMetricItems = person ? person.items.filter((it) => it.metrics.length === 0) : [];
  const hasNoMetric = noMetricItems.length > 0;
  const activeMetric =
    person && metric && (metric === NO_METRIC ? hasNoMetric : person.metricCounts[metric])
      ? metric
      : null;
  const metricLabel = activeMetric === NO_METRIC ? "No metric" : activeMetric;
  const metricItems =
    person && activeMetric
      ? activeMetric === NO_METRIC
        ? noMetricItems
        : person.items.filter((it) => it.metrics.includes(activeMetric))
      : [];

  function pickProgram(p: string) {
    setProgram(p);
    setPersonId(null);
    setMetric(null);
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">Program</span>
        <select value={program} onChange={(e) => pickProgram(e.target.value)} className={selCls}>
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
        {(month || etaFrom || etaTo) && (
          <button
            type="button"
            onClick={() => {
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

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm">
        <button
          type="button"
          onClick={() => {
            setPersonId(null);
            setMetric(null);
          }}
          className={person ? "text-accent hover:underline" : "font-semibold text-fg"}
        >
          {program} · People
        </button>
        {person && (
          <>
            <ChevronRight size={14} className="text-muted-2" />
            <button
              type="button"
              onClick={() => setMetric(null)}
              className={activeMetric ? "text-accent hover:underline" : "font-semibold text-fg"}
            >
              {person.name}
            </button>
          </>
        )}
        {person && activeMetric && (
          <>
            <ChevronRight size={14} className="text-muted-2" />
            <span className="font-semibold text-fg">{metricLabel}</span>
          </>
        )}
      </div>

      {/* LEVEL 1 — people */}
      {!person &&
        (rows.length === 0 ? (
          <Empty>No one has worked on {program} in this view.</Empty>
        ) : (
          <>
            <div className="text-xs text-muted">
              {peopleCount} {peopleCount === 1 ? "person" : "people"}
            </div>
            <div className="space-y-2">
              {rows.map((r) => {
                const metricCount = Object.keys(r.metricCounts).length;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setPersonId(r.id);
                      setMetric(null);
                    }}
                    className="flex w-full items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-border-strong hover:bg-surface-2"
                  >
                    <div>
                      <div className={`text-[13px] font-semibold ${r.id === UNASSIGNED_ID ? "italic text-muted" : "text-fg"}`}>
                        {r.name}
                      </div>
                      <div className="text-xs text-muted">
                        {r.tasks} task{r.tasks === 1 ? "" : "s"} · {r.adhoc} adhoc · {metricCount} metric
                        {metricCount === 1 ? "" : "s"}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-muted-2" />
                  </button>
                );
              })}
            </div>
          </>
        ))}

      {/* LEVEL 2 — a person's metrics */}
      {person && !activeMetric && (
        <>
          <PersonHeader person={person} />
          {Object.keys(person.metricCounts).length === 0 && !hasNoMetric ? (
            <Empty>No items for {person.name} in this view.</Empty>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(person.metricCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([m, c]) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMetric(m)}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5 text-left transition-colors hover:border-border-strong hover:bg-surface-2"
                  >
                    <span className="text-sm font-medium text-fg">{m}</span>
                    <span className="flex items-center gap-2 text-xs text-muted">
                      <span className="rounded bg-cyan-100 px-1.5 py-0.5 font-bold text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300">
                        {c} item{c === 1 ? "" : "s"}
                      </span>
                      <ChevronRight size={15} className="text-muted-2" />
                    </span>
                  </button>
                ))}
              {hasNoMetric && (
                <button
                  type="button"
                  onClick={() => setMetric(NO_METRIC)}
                  className="flex items-center justify-between rounded-lg border border-dashed border-border bg-surface px-3 py-2.5 text-left transition-colors hover:border-border-strong hover:bg-surface-2"
                >
                  <span className="text-sm font-medium italic text-muted">No metric</span>
                  <span className="flex items-center gap-2 text-xs text-muted">
                    <span className="rounded bg-surface-2 px-1.5 py-0.5 font-bold text-fg/70">
                      {noMetricItems.length} item{noMetricItems.length === 1 ? "" : "s"}
                    </span>
                    <ChevronRight size={15} className="text-muted-2" />
                  </span>
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* LEVEL 3 — items for the chosen metric */}
      {person && activeMetric && (
        <>
          <PersonHeader person={person} />
          <div className="text-xs text-muted">
            {metricItems.length} item{metricItems.length === 1 ? "" : "s"}{" "}
            {activeMetric === NO_METRIC ? (
              <>with <span className="font-medium text-fg/70">no metric</span></>
            ) : (
              <>tagged <span className="font-medium text-fg/70">{activeMetric}</span></>
            )}
          </div>
          <div className="space-y-2">
            {metricItems.map((it) => (
              <div
                key={`${it.kind}-${it.id}`}
                className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg border border-border bg-surface px-3 py-2.5"
              >
                <KindBadge kind={it.kind} />
                <span className="text-sm font-medium text-fg">{it.title}</span>
                <StatusBadge status={it.status} />
                {it.eta && <span className="text-xs text-muted">ETA {fmtDate(it.eta)}</span>}
                {it.stakeholders.length > 0 && (
                  <span className="text-xs text-muted">· stakeholders: {it.stakeholders.join(", ")}</span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PersonHeader({ person }: { person: PersonRow }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className={`text-sm font-semibold ${person.id === UNASSIGNED_ID ? "italic text-muted" : "text-fg"}`}>
        {person.name}
      </div>
      <div className="mt-0.5 text-xs text-muted">
        {person.tasks} task{person.tasks === 1 ? "" : "s"} · {person.adhoc} adhoc
      </div>
      {person.stakeholders.length > 0 && (
        <div className="mt-2 text-xs text-muted">
          <span className="font-medium text-fg/70">Stakeholders:</span> {person.stakeholders.join(", ")}
        </div>
      )}
    </div>
  );
}

function KindBadge({ kind }: { kind: "task" | "adhoc" }) {
  return kind === "task" ? (
    <span className="inline-flex items-center gap-1 rounded-md border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
      <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Task
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-md border border-pink-300 bg-pink-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-pink-600 dark:border-pink-900 dark:bg-pink-950/50 dark:text-pink-300">
      <span className="h-1.5 w-1.5 rounded-full bg-pink-500" /> Adhoc
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-sm text-muted">
      {children}
    </div>
  );
}
