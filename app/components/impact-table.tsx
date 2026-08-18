"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { Loader2, X, Sparkles, TrendingUp, AlertTriangle, MessageSquare, FileSpreadsheet } from "lucide-react";
import { upsertMetricImpact, aiSummarizeImpact } from "../(app)/actions";
import { METRIC_TYPES, type ImpactRow, type AiImpactSummary } from "@/lib/types";

// Tint per impact status for the summary chips (falls back to slate for custom ones).
const STATUS_CHIP: Record<string, string> = {
  Improved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  Regression: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  Stable: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  "To be updated": "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};
const chipCls = (s: string) =>
  STATUS_CHIP[s] ?? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";

// Shape of the client-computed rollup (grouped by program). Used both for the
// AI-summary fallback and internally.
type ProgramSummary = {
  program: string;
  total: number;
  recorded: number;
  pending: number;
  statuses: [string, number][];
  tasks: {
    title: string;
    assignee: string | null;
    stakeholders: string[];
    items: { metric: string; change: string; status: string }[];
  }[];
};
type ComputedSummary = {
  total: number;
  taskCount: number;
  recorded: number;
  pending: number;
  programs: ProgramSummary[];
};

const selCls = "max-w-full rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg outline-none focus:border-accent";
// In-table selects fill their column; the filter-bar ones must keep their natural
// width or they each wrap onto their own row.
const tableSelCls = `${selCls} w-full min-w-0`;
const inCls = "w-full min-w-0 rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg outline-none focus:border-accent";
const openCalendar = (e: React.MouseEvent<HTMLInputElement>) => (e.currentTarget as any).showPicker?.();

type Edit = {
  metricType: string;
  preLabel: string;
  preValue: string;
  preDesc: string;
  postLabel: string;
  postValue: string;
  postDesc: string;
  status: string;
};

// Auto-generated one-line summary from the current pre/post/status.
function autoSummary(e: Edit): string {
  const side = (label: string, value: string) => [label, value].filter(Boolean).join(" ").trim();
  const pre = side(e.preLabel, e.preValue);
  const post = side(e.postLabel, e.postValue);
  let s = pre && post ? `${pre} → ${post}` : post || pre || "";
  if (e.status) s = s ? `${s} · ${e.status}` : e.status;
  return s || "—";
}

const keyOf = (r: { taskId: string; metric: string }) => `${r.taskId}::${r.metric}`;
const toEdit = (r: ImpactRow): Edit => ({
  metricType: r.metricType ?? "",
  preLabel: r.preLabel ?? "",
  preValue: r.preValue ?? "",
  preDesc: r.preDesc ?? "",
  postLabel: r.postLabel ?? "",
  postValue: r.postValue ?? "",
  postDesc: r.postDesc ?? "",
  // Status starts at "To be updated" until an after-value is recorded.
  status: r.status ?? "To be updated",
});

// A status only makes sense once a post/after value exists.
const hasPostValue = (e: Edit) => !!((e.postValue ?? "").trim() || (e.postLabel ?? "").trim());

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });
}
function fmtMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function ImpactTable({
  rows,
  statusOptions,
  isAdmin,
  moPrograms,
  teams = [],
}: {
  rows: ImpactRow[];
  statusOptions: string[];
  isAdmin: boolean;
  moPrograms: string[];
  teams?: { id: string; name: string; memberIds: string[] }[];
}) {
  const [edits, setEdits] = useState<Record<string, Edit>>(() =>
    Object.fromEntries(rows.map((r) => [keyOf(r), toEdit(r)]))
  );
  const savedRef = useRef<Record<string, Edit>>(
    Object.fromEntries(rows.map((r) => [keyOf(r), toEdit(r)]))
  );
  const [dates, setDates] = useState<Record<string, { pre: string | null; post: string | null }>>(() =>
    Object.fromEntries(rows.map((r) => [keyOf(r), { pre: r.preUpdatedAt, post: r.postUpdatedAt }]))
  );
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiData, setAiData] = useState<AiImpactSummary | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Filters
  const [month, setMonth] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [assignee, setAssignee] = useState("");
  const [stakeholder, setStakeholder] = useState("");
  const [program, setProgram] = useState(""); // admin-only
  const [team, setTeam] = useState(""); // admin-only, team id
  const [metric, setMetric] = useState("");

  const teamMemberSet = useMemo(() => {
    const t = teams.find((x) => x.id === team);
    return t ? new Set(t.memberIds) : null;
  }, [teams, team]);

  const canEditRow = (r: ImpactRow) =>
    isAdmin || (!!r.program && moPrograms.includes(r.program));

  const assignees = useMemo(
    () => Array.from(new Set(rows.map((r) => r.assignee).filter(Boolean) as string[])).sort(),
    [rows]
  );
  const stakeholders = useMemo(
    () => Array.from(new Set(rows.flatMap((r) => r.stakeholders))).sort(),
    [rows]
  );
  const programOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.program).filter(Boolean) as string[])).sort(),
    [rows]
  );
  const metricOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.metric).filter(Boolean))).sort(),
    [rows]
  );
  const months = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) if (r.deliveredDate) s.add(r.deliveredDate.slice(0, 7));
    return Array.from(s).sort().reverse();
  }, [rows]);

  const visible = useMemo(
    () =>
      rows.filter((r) => {
        const d = r.deliveredDate;
        if (month && (!d || !d.startsWith(month))) return false;
        if (from && (!d || d < from)) return false;
        if (to && (!d || d > to)) return false;
        if (assignee && r.assignee !== assignee) return false;
        if (stakeholder && !r.stakeholders.includes(stakeholder)) return false;
        if (isAdmin && program && r.program !== program) return false;
        if (isAdmin && teamMemberSet && !(r.assigneeId && teamMemberSet.has(r.assigneeId))) return false;
        if (metric && r.metric !== metric) return false;
        return true;
      }),
    [rows, month, from, to, assignee, stakeholder, program, teamMemberSet, metric, isAdmin]
  );

  const anyFilter = month || from || to || assignee || stakeholder || (isAdmin && (program || team)) || metric;

  // Distinct completed tasks across all rows (each row is one task×metric).
  const totalTasks = useMemo(() => new Set(rows.map((r) => r.taskId)).size, [rows]);

  // Group a task's metric-rows together so task info shows once per task.
  const groups = useMemo(() => {
    const m = new Map<string, ImpactRow[]>();
    for (const r of visible) {
      const g = m.get(r.taskId) ?? [];
      g.push(r);
      m.set(r.taskId, g);
    }
    return Array.from(m.values());
  }, [visible]);

  // Human-readable filter description shown atop the summary.
  const activeFilters = useMemo(() => {
    const f: string[] = [];
    if (month) f.push(fmtMonth(month));
    if (from) f.push(`from ${from}`);
    if (to) f.push(`to ${to}`);
    if (assignee) f.push(assignee);
    if (stakeholder) f.push(`stakeholder: ${stakeholder}`);
    if (isAdmin && program) f.push(program);
    if (isAdmin && team) f.push(`team: ${teams.find((t) => t.id === team)?.name ?? team}`);
    if (metric) f.push(metric);
    return f;
  }, [month, from, to, assignee, stakeholder, program, team, teams, metric, isAdmin]);

  // Roll up the currently-visible (filtered) rows into a readable summary,
  // grouped by PROGRAM: each program gets its own status counts + task changes.
  const summary = useMemo(() => {
    type TaskAgg = {
      title: string;
      assignee: string | null;
      stakeholders: string[];
      items: { metric: string; change: string; status: string }[];
    };
    type ProgAgg = { byStatus: Map<string, number>; taskMap: Map<string, TaskAgg>; total: number; recorded: number };
    const progMap = new Map<string, ProgAgg>();
    let recorded = 0;

    for (const r of visible) {
      const e = edits[keyOf(r)];
      if (!e) continue;
      const prog = r.program ?? "Unclassified";
      const pg =
        progMap.get(prog) ?? { byStatus: new Map<string, number>(), taskMap: new Map<string, TaskAgg>(), total: 0, recorded: 0 };
      const status = e.status || "No status";
      pg.byStatus.set(status, (pg.byStatus.get(status) ?? 0) + 1);
      pg.total++;
      if (e.postValue || e.postLabel) {
        pg.recorded++;
        recorded++;
      }
      const g =
        pg.taskMap.get(r.taskId) ?? { title: r.taskTitle, assignee: r.assignee, stakeholders: r.stakeholders, items: [] };
      g.items.push({ metric: r.metric, change: autoSummary(e), status });
      pg.taskMap.set(r.taskId, g);
      progMap.set(prog, pg);
    }

    const programs = Array.from(progMap.entries())
      .map(([program, pg]) => ({
        program,
        total: pg.total,
        recorded: pg.recorded,
        pending: pg.total - pg.recorded,
        statuses: Array.from(pg.byStatus.entries()).sort((a, b) => b[1] - a[1]),
        tasks: Array.from(pg.taskMap.values()),
      }))
      // Alphabetical, but keep "Unclassified" at the very end.
      .sort((a, b) =>
        a.program === "Unclassified" ? 1 : b.program === "Unclassified" ? -1 : a.program.localeCompare(b.program)
      );

    return {
      total: visible.length,
      taskCount: programs.reduce((n, p) => n + p.tasks.length, 0),
      recorded,
      pending: visible.length - recorded,
      programs,
    };
  }, [visible, edits]);

  function setField(key: string, field: keyof Edit, value: string) {
    setEdits((e) => ({ ...e, [key]: { ...e[key], [field]: value } }));
  }
  const dirty = (key: string) => JSON.stringify(edits[key]) !== JSON.stringify(savedRef.current[key]);

  function save(r: ImpactRow) {
    const key = keyOf(r);
    const e = edits[key];
    const s = savedRef.current[key];
    setSavingKey(key);
    startTransition(async () => {
      const res = await upsertMetricImpact({
        taskId: r.taskId,
        metric: r.metric,
        metricType: e.metricType,
        preLabel: e.preLabel,
        preValue: e.preValue,
        preDesc: e.preDesc,
        postLabel: e.postLabel,
        postValue: e.postValue,
        postDesc: e.postDesc,
        status: hasPostValue(e) ? e.status : "To be updated",
      });
      setSavingKey(null);
      if (res?.error) {
        alert(res.error);
        return;
      }
      const preChanged = e.preLabel !== s.preLabel || e.preValue !== s.preValue || e.preDesc !== s.preDesc;
      const postChanged = e.postLabel !== s.postLabel || e.postValue !== s.postValue || e.postDesc !== s.postDesc;
      const today = new Date().toISOString().slice(0, 10);
      setDates((d) => ({
        ...d,
        [key]: {
          pre: preChanged && (e.preLabel || e.preValue || e.preDesc) ? today : d[key]?.pre ?? null,
          post: postChanged && (e.postLabel || e.postValue || e.postDesc) ? today : d[key]?.post ?? null,
        },
      }));
      savedRef.current[key] = { ...e };
      setOpenNote(null);
    });
  }

  async function runAiSummary() {
    setAiOpen(true);
    setAiLoading(true);
    setAiError(null);
    setAiData(null);
    const payload = {
      filters: activeFilters,
      rows: visible.map((r) => {
        const e = edits[keyOf(r)];
        return {
          task: r.taskTitle,
          assignee: r.assignee,
          program: r.program,
          stakeholders: r.stakeholders,
          metric: r.metric,
          metricType: e?.metricType || null,
          pre: [e?.preLabel, e?.preValue].filter(Boolean).join(" ").trim(),
          post: [e?.postLabel, e?.postValue].filter(Boolean).join(" ").trim(),
          status: e?.status || "No status",
          note: [e?.preDesc, e?.postDesc].filter(Boolean).join(" | "),
        };
      }),
    };
    const res = await aiSummarizeImpact(payload);
    setAiLoading(false);
    if (res.error) setAiError(res.error);
    else setAiData(res.summary ?? null);
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select value={month} onChange={(e) => setMonth(e.target.value)} className={`${selCls} py-1.5`}>
          <option value="">Any month</option>
          {months.map((m) => (
            <option key={m} value={m}>{fmtMonth(m)}</option>
          ))}
        </select>
        <span className="text-muted">Delivered</span>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} onClick={openCalendar} className={`${selCls} cursor-pointer py-1.5`} />
        <span className="text-muted">to</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} onClick={openCalendar} className={`${selCls} cursor-pointer py-1.5`} />
        <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={`${selCls} py-1.5`}>
          <option value="">Anyone</option>
          {assignees.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select value={stakeholder} onChange={(e) => setStakeholder(e.target.value)} className={`${selCls} py-1.5`}>
          <option value="">Any stakeholder</option>
          {stakeholders.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {isAdmin && programOptions.length > 0 && (
          <select value={program} onChange={(e) => setProgram(e.target.value)} className={`${selCls} py-1.5`}>
            <option value="">All programs</option>
            {programOptions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}
        {isAdmin && teams.length > 0 && (
          <select value={team} onChange={(e) => setTeam(e.target.value)} title="Filter by team" className={`${selCls} py-1.5`}>
            <option value="">All teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
        {metricOptions.length > 0 && (
          <select value={metric} onChange={(e) => setMetric(e.target.value)} className={`${selCls} py-1.5`}>
            <option value="">All metrics</option>
            {metricOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        )}
        {anyFilter && (
          <button
            type="button"
            onClick={() => { setMonth(""); setFrom(""); setTo(""); setAssignee(""); setStakeholder(""); setProgram(""); setTeam(""); setMetric(""); }}
            className="text-xs text-accent hover:underline"
          >
            Clear
          </button>
        )}
        <button
          type="button"
          onClick={runAiSummary}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-accent bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Sparkles size={14} /> AI summary
        </button>
        <span className="text-xs text-muted">
          {groups.length} of {totalTasks} task{totalTasks === 1 ? "" : "s"}
        </span>
      </div>

      <div className="max-h-[70vh] overflow-y-auto overflow-x-hidden rounded-xl border border-border bg-surface">
        <table className="w-full table-fixed text-left text-xs">
          <colgroup>
            {/* Widths measured against real rendered text in Plus Jakarta Sans, at the
                1232px the max-w-7xl shell gives this table:
                  Type   needs 129px ("Non-Tangible")   Status needs 134px ("To be updated")
                  Name   needs 114px (Slack+Sheet row)  Delivered/Last edited: 88/97px
                Everything fits without a horizontal scrollbar. */}
            <col className="w-[9.5%]" />{/* Name */}
            <col className="w-[10.5%]" />{/* Task */}
            <col className="w-[8.5%]" />{/* Description */}
            <col className="w-[7.5%]" />{/* Delivered */}
            <col className="w-[7%]" />{/* Metric */}
            <col className="w-[11%]" />{/* Type */}
            <col className="w-[10.5%]" />{/* Pre value */}
            <col className="w-[10.5%]" />{/* Post value */}
            <col className="w-[11.5%]" />{/* Status */}
            <col className="w-[8%]" />{/* Last edited */}
            <col className="w-[5.5%]" />{/* Save */}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-surface-2 uppercase tracking-wide text-muted shadow-sm">
            <tr>
              <th className="px-2.5 py-2.5 font-semibold">Name</th>
              <th className="px-2.5 py-2.5 font-semibold">Task</th>
              <th className="px-2.5 py-2.5 font-semibold">Description</th>
              <th className="px-2.5 py-2.5 font-semibold">Delivered</th>
              <th className="px-2.5 py-2.5 font-semibold">Metric</th>
              <th className="px-2.5 py-2.5 font-semibold">Type</th>
              <th className="px-2.5 py-2.5 font-semibold">Pre value</th>
              <th className="px-2.5 py-2.5 font-semibold">Post value</th>
              <th className="px-2.5 py-2.5 font-semibold">Status</th>
              <th className="px-2.5 py-2.5 font-semibold">Last edited</th>
              <th className="px-2.5 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={11} className="px-2.5 py-10 text-center text-muted">
                  No completed tasks with metrics match these filters.
                </td>
              </tr>
            )}
            {groups.map((group, gi) =>
              group.map((r, i) => {
              const key = keyOf(r);
              const e = edits[key];
              const editable = canEditRow(r);
              const saving = savingKey === key;
              const hasPost = hasPostValue(e);
              const zebra = gi % 2 === 1 ? "bg-surface-2/20" : "";
              const rowBorder = i === 0 ? "border-t-[3px] border-border" : "border-t border-border/50";
              return (
                <tr key={key} className={`align-top ${zebra} ${rowBorder}`}>
                  {i === 0 && (
                    <>
                      <td rowSpan={group.length} className="px-2.5 py-2 font-medium text-fg/80 break-words">
                        <div>{r.assignee ?? "—"}</div>
                        {(r.slackLink || r.sheetLink) && (
                          <div className="mt-1.5 flex items-center gap-2">
                            {r.slackLink && (
                              <a
                                href={r.slackLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium text-accent hover:underline"
                              >
                                <MessageSquare size={11} /> Slack
                              </a>
                            )}
                            {r.sheetLink && (
                              <a
                                href={r.sheetLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium text-accent hover:underline"
                              >
                                <FileSpreadsheet size={11} /> Sheet
                              </a>
                            )}
                          </div>
                        )}
                      </td>
                      <td rowSpan={group.length} className="px-2.5 py-2 font-semibold text-fg break-words">
                        <Link
                          href={`/board?task=${r.taskId}`}
                          title="Open this task on the Board"
                          className="text-accent hover:underline"
                        >
                          {r.taskTitle}
                        </Link>
                      </td>
                      <td rowSpan={group.length} className="px-2.5 py-2 text-muted break-words">
                        {r.description ? (
                          <div className="group relative">
                            <div className="line-clamp-3 cursor-default">{r.description}</div>
                            <span className="pointer-events-none absolute left-0 top-full z-30 mt-1 hidden w-72 whitespace-pre-line rounded-md border border-border bg-surface p-2 text-[11px] leading-relaxed text-fg shadow-lg group-hover:block">
                              {r.description}
                            </span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td rowSpan={group.length} className="whitespace-nowrap px-2.5 py-2 text-muted">
                        {fmtDate(r.deliveredDate)}
                      </td>
                    </>
                  )}
                  <td className="px-2.5 py-2 font-medium text-fg/80 break-words">{r.metric}</td>

                  {/* Metric type */}
                  <td className="px-2.5 py-2">
                    {editable ? (
                      <select value={e.metricType} onChange={(ev) => setField(key, "metricType", ev.target.value)} className={tableSelCls}>
                        <option value="">—</option>
                        {METRIC_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    ) : (
                      <span>{e.metricType || "—"}</span>
                    )}
                  </td>

                  {/* Pre value */}
                  <td className="px-2.5 py-2">
                    <ValueCell
                      side="pre"
                      rowKey={key}
                      label={e.preLabel}
                      value={e.preValue}
                      desc={e.preDesc}
                      editable={editable}
                      openNote={openNote}
                      setOpenNote={setOpenNote}
                      onChange={(f, v) => setField(key, f === "label" ? "preLabel" : f === "value" ? "preValue" : "preDesc", v)}
                    />
                  </td>

                  {/* Post value */}
                  <td className="px-2.5 py-2">
                    <ValueCell
                      side="post"
                      rowKey={key}
                      label={e.postLabel}
                      value={e.postValue}
                      desc={e.postDesc}
                      editable={editable}
                      openNote={openNote}
                      setOpenNote={setOpenNote}
                      onChange={(f, v) => setField(key, f === "label" ? "postLabel" : f === "value" ? "postValue" : "postDesc", v)}
                    />
                  </td>

                  {/* Status — locked to "To be updated" until a post value exists. */}
                  <td className="px-2.5 py-2">
                    {editable ? (
                      <select
                        value={hasPost ? e.status : "To be updated"}
                        onChange={(ev) => setField(key, "status", ev.target.value)}
                        disabled={!hasPost}
                        title={hasPost ? undefined : "Fill the post value to set a status"}
                        className={`${tableSelCls} ${hasPost ? "" : "cursor-not-allowed opacity-60"}`}
                      >
                        {hasPost ? (
                          statusOptions.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))
                        ) : (
                          <option value="To be updated">To be updated</option>
                        )}
                      </select>
                    ) : (
                      <span>{e.status || "—"}</span>
                    )}
                  </td>

                  {/* Last edited */}
                  <td className="whitespace-nowrap px-2.5 py-2 text-[11px] text-muted">
                    <div>Pre {fmtDate(dates[key]?.pre ?? null)}</div>
                    <div>Post {fmtDate(dates[key]?.post ?? null)}</div>
                  </td>

                  {/* Save */}
                  <td className="px-2.5 py-2">
                    {editable && dirty(key) && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => save(r)}
                        className="inline-flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
                      >
                        {saving && <Loader2 size={12} className="animate-spin" />} Save
                      </button>
                    )}
                  </td>
                </tr>
              );
              })
            )}
          </tbody>
        </table>
      </div>
      {!isAdmin && moPrograms.length === 0 && (
        <p className="text-xs text-muted">View only — admins and module owners can edit impact.</p>
      )}

      {aiOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAiOpen(false);
          }}
        >
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-surface shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
              <div>
                <h2 className="flex items-center gap-1.5 text-base font-semibold text-fg">
                  <Sparkles size={16} className="text-accent" /> AI summary
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  {visible.length} metric{visible.length === 1 ? "" : "s"} across {groups.length} task
                  {groups.length === 1 ? "" : "s"}
                  {activeFilters.length > 0 && <> · {activeFilters.join(" · ")}</>}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!aiLoading && (
                  <button
                    type="button"
                    onClick={runAiSummary}
                    title="Regenerate"
                    className="rounded-lg px-2 py-1 text-xs font-medium text-accent hover:bg-surface-2"
                  >
                    Regenerate
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAiOpen(false)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
              {aiLoading ? (
                <div className="flex items-center gap-2 py-8 text-sm text-muted">
                  <Loader2 size={16} className="animate-spin" /> Generating summary…
                </div>
              ) : aiError ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                    Couldn&apos;t generate the AI summary ({aiError}) — showing a basic breakdown instead.
                  </div>
                  <SummaryBody summary={summary} />
                </div>
              ) : aiData ? (
                <div className="space-y-7">
                  {/* Overall takeaway */}
                  {aiData.overview && (
                    <p className="border-l-2 border-accent pl-3 text-sm leading-relaxed text-fg">
                      {aiData.overview}
                    </p>
                  )}

                  {/* One block per program */}
                  {aiData.programs.map((pg, pi) => (
                    <section key={pi} className="space-y-3">
                      <div className="flex items-center gap-2 border-b border-border pb-1.5">
                        <span className="h-3 w-1 rounded-full bg-accent" />
                        <h3 className="text-sm font-bold text-fg">{pg.program}</h3>
                      </div>

                      {pg.summary && <p className="text-xs leading-relaxed text-fg/90">{pg.summary}</p>}

                      {pg.highlights.length > 0 && (
                        <div>
                          <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                            <TrendingUp size={12} /> Highlights
                          </h4>
                          <ul className="space-y-2.5">
                            {pg.highlights.map((h, i) => (
                              <li key={i} className="flex gap-2.5">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                                <div>
                                  <div className="text-sm font-semibold text-fg">{h.title}</div>
                                  <div className="text-xs leading-relaxed text-muted">{h.detail}</div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {pg.watch.length > 0 && (
                        <div>
                          <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                            <AlertTriangle size={12} /> Watch
                          </h4>
                          <ul className="space-y-2.5">
                            {pg.watch.map((w, i) => (
                              <li key={i} className="flex gap-2.5">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                                <div>
                                  <div className="text-sm font-semibold text-fg">{w.title}</div>
                                  <div className="text-xs leading-relaxed text-muted">{w.detail}</div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </section>
                  ))}
                </div>
              ) : null}
              <p className="mt-6 border-t border-border pt-3 text-[11px] text-muted">
                Generated by AI from the filtered rows above — double-check before sharing.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// A pre/post cell: label and value stacked so each input gets the full column
// width (side by side they were ~48px and you couldn't read what you typed).
function ValueCell({
  side,
  rowKey,
  label,
  value,
  desc,
  editable,
  openNote,
  setOpenNote,
  onChange,
}: {
  side: "pre" | "post";
  rowKey: string;
  label: string;
  value: string;
  desc: string;
  editable: boolean;
  openNote: string | null;
  setOpenNote: (k: string | null) => void;
  onChange: (field: "label" | "value" | "desc", v: string) => void;
}) {
  const noteKey = `${rowKey}:${side}`;
  const isOpen = openNote === noteKey;
  const sideName = side === "pre" ? "Pre" : "Post";
  // Anchor pop-ups inward so the right-hand column can't push them out of view.
  const anchor = side === "post" ? "right-0" : "left-0";

  const noteButton =
    editable || desc ? (
      <span className="group relative flex shrink-0">
        <button
          type="button"
          onClick={() => setOpenNote(isOpen ? null : noteKey)}
          title={desc ? undefined : "Add a note"}
          className={`grid h-6 w-6 shrink-0 place-items-center rounded ${desc ? "text-accent" : "text-muted"} hover:bg-surface-2`}
        >
          {desc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/done.png" alt="Note added" className="h-3.5 w-3.5 object-contain dark:brightness-0 dark:invert" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/sticky-note.png" alt="Add note" className="h-3.5 w-3.5 object-contain" />
          )}
        </button>
        {/* Hover preview of the note (click still opens the editable popover). */}
        {desc && !isOpen && (
          <span
            className={`pointer-events-none absolute ${anchor} top-7 z-30 hidden w-56 whitespace-pre-line rounded-md border border-border bg-surface p-2 text-[11px] leading-relaxed text-fg/80 shadow-lg group-hover:block`}
          >
            {desc}
          </span>
        )}
      </span>
    ) : null;

  return (
    <div className="relative">
      {editable ? (
        <div className="flex flex-col gap-1">
          {/* Label gets the full column (they run long: "Lead conversion"); the note
              button rides with the value, which is usually just a number. */}
          <input
            value={label}
            onChange={(e) => onChange("label", e.target.value)}
            placeholder="e.g. Avg"
            title={label || undefined}
            aria-label={`${sideName} value label`}
            className={inCls}
          />
          <div className="flex items-center gap-1">
            <input
              value={value}
              onChange={(e) => onChange("value", e.target.value)}
              placeholder="e.g. 4.7"
              title={value || undefined}
              aria-label={`${sideName} value`}
              className={`${inCls} flex-1`}
            />
            {noteButton}
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-1">
          <span className="min-w-0 break-words text-fg/80">
            {label || value ? `${label || "—"}: ${value || "—"}` : "—"}
          </span>
          {noteButton}
        </div>
      )}
      {isOpen && (
        <div className={`absolute ${anchor} z-20 mt-1 w-64 rounded-lg border border-border bg-surface p-2 shadow-lg`}>
          {editable ? (
            <textarea
              value={desc}
              onChange={(e) => onChange("desc", e.target.value)}
              rows={3}
              placeholder="Optional explanation…"
              className="w-full rounded-md border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
              autoFocus
            />
          ) : (
            <p className="whitespace-pre-line text-xs text-fg/80">{desc || "No description."}</p>
          )}
        </div>
      )}
    </div>
  );
}

// Non-AI rollup, grouped by program. Shown as the AI-summary fallback.
function SummaryBody({ summary }: { summary: ComputedSummary }) {
  if (summary.total === 0) {
    return <p className="text-sm text-muted">No completed tasks with metrics match these filters.</p>;
  }
  return (
    <div className="space-y-7">
      <p className="text-xs text-muted">
        {summary.recorded} recorded · {summary.pending} pending post-value across {summary.programs.length} program
        {summary.programs.length === 1 ? "" : "s"}.
      </p>

      {summary.programs.map((pg) => (
        <section key={pg.program}>
          <div className="mb-3 flex items-center justify-between gap-3 border-b border-border pb-1.5">
            <h3 className="flex items-center gap-2 text-sm font-bold text-fg">
              <span className="h-3 w-1 rounded-full bg-accent" />
              {pg.program}
            </h3>
            <span className="shrink-0 text-[11px] text-muted">
              {pg.total} metric{pg.total === 1 ? "" : "s"} · {pg.tasks.length} task
              {pg.tasks.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            {pg.statuses.map(([s, n]) => (
              <span key={s} className={`rounded-full px-3 py-1 text-xs font-medium ${chipCls(s)}`}>
                {s} · {n}
              </span>
            ))}
          </div>

          <div className="space-y-3">
            {pg.tasks.map((t, i) => (
              <div key={i} className="rounded-lg border border-border bg-surface-2/30 p-3">
                <div className="text-sm font-semibold text-fg">{t.title}</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                  <span className="rounded-full bg-surface px-2 py-0.5 text-fg/80">
                    <span className="text-muted">Owner:</span> {t.assignee ?? "Unassigned"}
                  </span>
                  {t.stakeholders.length > 0 && (
                    <span className="rounded-full bg-surface px-2 py-0.5 text-fg/80">
                      <span className="text-muted">Stakeholders:</span> {t.stakeholders.join(", ")}
                    </span>
                  )}
                </div>
                <ul className="mt-2.5 space-y-1.5">
                  {t.items.map((it, j) => (
                    <li key={j} className="flex items-baseline gap-2 text-sm">
                      <span className="min-w-[110px] shrink-0 font-medium text-fg/70">{it.metric}</span>
                      <span className="text-fg">{it.change}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
