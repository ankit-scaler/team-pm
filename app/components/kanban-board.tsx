"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, MessageSquare, FileSpreadsheet, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { changeStatus, changeAdhocStatus } from "../(app)/actions";
import { TaskForm } from "./task-form";
import { AdhocDeleteButton } from "./adhoc-delete-button";
import { AdhocForm } from "./adhoc-form";
import { StatusBadge, PriorityLabel, EffortChip } from "./status-badge";
import {
  STATUSES,
  STAGE_ACCENT,
  type AdhocRequest,
  type Profile,
  type Status,
  type Task,
} from "@/lib/types";

function isDelayed(t: Task) {
  return t.status === "Completed" && t.eta && t.delivered_date && t.delivered_date > t.eta;
}
function isAdhocOverdue(a: AdhocRequest) {
  return (
    !!a.eta &&
    a.status !== "Completed" &&
    new Date(a.eta + "T00:00:00") < new Date(new Date().toDateString())
  );
}
function isAdhocDelayed(a: AdhocRequest) {
  return a.status === "Completed" && !!a.eta && !!a.delivered_date && a.delivered_date > a.eta;
}

function fmt(d: string | null) {
  if (!d) return null;
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
// "2026-07" → "Jul 2026"
function fmtMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function KanbanBoard({
  tasks,
  people,
  adhocRequests = [],
  allTags = [],
  allMetrics = [],
}: {
  tasks: Task[];
  people: Profile[];
  adhocRequests?: AdhocRequest[];
  allTags?: string[];
  allMetrics?: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [movingId, setMovingId] = useState<string | null>(null);
  const [assignee, setAssignee] = useState("");
  const [tag, setTag] = useState("");
  const [month, setMonth] = useState(""); // YYYY-MM, matched against ETA
  const [q, setQ] = useState("");

  // Clear the per-card spinner once the move's server action settles.
  useEffect(() => {
    if (!isPending) setMovingId(null);
  }, [isPending]);

  // Live-refresh when anyone changes a task.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("tasks-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () =>
        router.refresh()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const visible = useMemo(() => {
    return tasks.filter((t) => {
      if (assignee === "unassigned" ? t.assignee_id : assignee && t.assignee_id !== assignee)
        return false;
      if (tag && !t.tags.includes(tag)) return false;
      if (month && (!t.eta || !t.eta.startsWith(month))) return false;
      if (q && !t.title.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [tasks, assignee, tag, month, q]);

  // Adhoc requests appear on the board too, in their status column. They have no
  // tags, so the tag filter hides them; the person filter matches their assignee.
  const visibleAdhoc = useMemo(() => {
    if (tag) return [];
    return adhocRequests.filter((a) => {
      if (assignee === "unassigned" ? a.assignee_id : assignee && a.assignee_id !== assignee)
        return false;
      if (month && (!a.eta || !a.eta.startsWith(month))) return false;
      if (q) {
        const hay = [a.title, a.module, a.program, a.raised_by, a.assignee?.full_name, a.assignee?.email]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [adhocRequests, assignee, tag, month, q]);

  const anyFilter = assignee || tag || month || q;

  // Distinct ETA months across tasks + adhoc, newest first.
  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of tasks) if (t.eta) set.add(t.eta.slice(0, 7));
    for (const a of adhocRequests) if (a.eta) set.add(a.eta.slice(0, 7));
    return Array.from(set).sort().reverse();
  }, [tasks, adhocRequests]);

  function move(task: Task, dir: -1 | 1) {
    const idx = STATUSES.indexOf(task.status);
    const next = STATUSES[idx + dir];
    if (!next) return;
    setMovingId(task.id);
    startTransition(() => changeStatus(task.id, next as Status));
  }

  function moveAdhoc(a: AdhocRequest, dir: -1 | 1) {
    const idx = STATUSES.indexOf(a.status);
    const next = STATUSES[idx + dir];
    if (!next) return;
    setMovingId(a.id);
    startTransition(() => changeAdhocStatus(a.id, next as Status));
  }

  const selCls = "rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-fg outline-none transition-colors focus:border-accent hover:border-border-strong";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={selCls}>
          <option value="">Everyone</option>
          <option value="unassigned">Unassigned</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.email}</option>
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
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          title="Filter by ETA month"
          className={selCls}
        >
          <option value="">Any month</option>
          {monthOptions.map((m) => (
            <option key={m} value={m}>{fmtMonth(m)}</option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search…"
          className="min-w-[140px] flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
        {anyFilter && (
          <button
            type="button"
            onClick={() => {
              setAssignee("");
              setTag("");
              setMonth("");
              setQ("");
            }}
            className="text-xs text-accent hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STATUSES.map((col) => {
          const items = visible.filter((t) => t.status === col);
          const adhocItems = visibleAdhoc.filter((a) => a.status === col);
          return (
            <section key={col} className="flex flex-col rounded-xl border border-border bg-surface/40">
              <header className="flex items-center justify-between border-b border-border px-3 py-2.5">
                <StatusBadge status={col} />
                <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-xs font-semibold text-muted">
                  {items.length + adhocItems.length}
                </span>
              </header>

              <div className="flex-1 space-y-2 p-2">
                {items.length === 0 && adhocItems.length === 0 && (
                  <p className="px-1 py-6 text-center text-xs text-muted">Nothing here</p>
                )}
                {adhocItems.map((a) => (
                  <AdhocCard
                    key={a.id}
                    a={a}
                    col={col}
                    people={people}
                    onMove={moveAdhoc}
                    moving={isPending && movingId === a.id}
                  />
                ))}
                {items.map((t) => {
                  const moving = isPending && movingId === t.id;
                  return (
                  <article
                    key={t.id}
                    className={`group relative rounded-lg border border-l-[3px] border-border ${STAGE_ACCENT[col]} bg-surface p-3.5 shadow-sm transition-shadow hover:shadow-md`}
                  >
                    {moving && (
                      <div className="absolute inset-0 z-10 grid place-items-center rounded-lg bg-surface/60 backdrop-blur-[1px]">
                        <Loader2 size={18} className="animate-spin text-accent" />
                      </div>
                    )}
                    {/* Title + action */}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-[13px] font-semibold leading-snug text-fg">
                        {t.title}
                      </h3>
                      <div className="opacity-0 transition-opacity group-hover:opacity-100">
                        <TaskForm people={people} task={t} allTags={allTags} allMetrics={allMetrics} />
                      </div>
                    </div>

                    {/* Meta row: priority · effort · ETA · delivered · delayed */}
                    <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted">
                      <PriorityLabel priority={t.priority} />
                      {t.effort && (
                        <>
                          <span aria-hidden className="text-muted-2">·</span>
                          <EffortChip effort={t.effort} />
                        </>
                      )}
                      {t.eta && (
                        <>
                          <span aria-hidden className="text-muted-2">·</span>
                          <span className="font-medium">ETA {fmt(t.eta)}</span>
                        </>
                      )}
                      {t.status === "Completed" && t.delivered_date && (
                        <>
                          <span aria-hidden className="text-muted-2">·</span>
                          <span className="font-medium text-emerald-700 dark:text-emerald-400">
                            Delivered {fmt(t.delivered_date)}
                          </span>
                        </>
                      )}
                      {isDelayed(t) && (
                        <span className="inline-flex items-center rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
                          Delayed
                        </span>
                      )}
                    </div>

                    {/* Taxonomy chips — one row, unified style, semantic dot for kind */}
                    {(t.program || t.track || t.tags.length > 0 || t.metrics.length > 0) && (
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {t.program && (
                          <Chip label={t.program} tone="program" />
                        )}
                        {t.track && (
                          <Chip label={t.track} tone="track" />
                        )}
                        {t.tags.map((tg) => (
                          <Chip key={tg} label={`#${tg}`} tone="tag" />
                        ))}
                        {t.metrics.map((m) => (
                          <Chip key={m} label={m} tone="metric" />
                        ))}
                      </div>
                    )}

                    {/* Links */}
                    {(t.slack_link || t.sheet_link) && (
                      <div className="mt-2.5 flex items-center gap-3">
                        {t.slack_link && (
                          <a
                            href={t.slack_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
                          >
                            <MessageSquare size={11} /> Slack
                          </a>
                        )}
                        {t.sheet_link && (
                          <a
                            href={t.sheet_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
                          >
                            <FileSpreadsheet size={11} /> Sheet
                          </a>
                        )}
                      </div>
                    )}

                    <div className="mt-3 flex flex-col gap-1.5 border-t border-border pt-2.5">
                      {t.creator && t.assignee && t.created_by !== t.assignee_id && (
                        <span className="text-[11px] text-muted">
                          Raised by <span className="font-medium text-fg/70">{t.creator.full_name ?? t.creator.email}</span>
                        </span>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 truncate text-xs">
                          <span className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-accent-soft text-[10px] font-semibold text-accent">
                            {t.assignee
                              ? (t.assignee.full_name ?? t.assignee.email)[0]?.toUpperCase()
                              : "?"}
                          </span>
                          <span className="truncate font-medium text-fg/80">
                            {t.assignee ? (t.assignee.full_name ?? t.assignee.email) : "Unassigned"}
                          </span>
                        </span>
                        <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => move(t, -1)}
                          disabled={moving || STATUSES.indexOf(t.status) === 0}
                          className="grid h-6 w-6 place-items-center rounded text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-25"
                          aria-label="Move back"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(t, 1)}
                          disabled={moving || STATUSES.indexOf(t.status) === STATUSES.length - 1}
                          className="grid h-6 w-6 place-items-center rounded text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-25"
                          aria-label="Move forward"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                      </div>
                    </div>
                  </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// Adhoc request rendered as a board card — badged "Adhoc", movable across stages.
function AdhocCard({
  a,
  col,
  people,
  onMove,
  moving = false,
}: {
  a: AdhocRequest;
  col: Status;
  people: Profile[];
  onMove: (a: AdhocRequest, dir: -1 | 1) => void;
  moving?: boolean;
}) {
  const title = a.title || a.module || a.program || "Adhoc request";
  return (
    <article
      className={`group relative rounded-lg border border-l-[3px] border-border ${STAGE_ACCENT[col]} bg-surface p-3.5 shadow-sm transition-shadow hover:shadow-md`}
    >
      {moving && (
        <div className="absolute inset-0 z-10 grid place-items-center rounded-lg bg-surface/60 backdrop-blur-[1px]">
          <Loader2 size={18} className="animate-spin text-accent" />
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[13px] font-semibold leading-snug text-fg">{title}</h3>
        <div className="flex shrink-0 items-center gap-1">
          <span className="inline-flex items-center rounded-md border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
            Adhoc
          </span>
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <AdhocForm
              request={a}
              people={people}
              triggerClassName="grid h-6 w-6 place-items-center rounded text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            />
            <AdhocDeleteButton
              id={a.id}
              className="grid h-6 w-6 place-items-center rounded text-muted transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            />
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted">
        {a.source === "slack" && !a.eta && (
          <span className="inline-flex items-center rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
            Incomplete
          </span>
        )}
        {a.eta && (
          <span className={`font-medium ${isAdhocOverdue(a) ? "text-red-600 dark:text-red-400" : ""}`}>
            ETA {fmt(a.eta)}
          </span>
        )}
        {isAdhocOverdue(a) && (
          <span className="inline-flex items-center rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
            Overdue
          </span>
        )}
        {a.status === "Completed" && a.delivered_date && (
          <>
            {a.eta && <span aria-hidden className="text-muted-2">·</span>}
            <span className="font-medium text-emerald-700 dark:text-emerald-400">
              Delivered {fmt(a.delivered_date)}
            </span>
          </>
        )}
        {isAdhocDelayed(a) && (
          <span className="inline-flex items-center rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
            Delayed
          </span>
        )}
        {a.learners_impact && (
          <>
            <span aria-hidden className="text-muted-2">·</span>
            <span>{a.learners_impact} learners</span>
          </>
        )}
      </div>

      {(a.program || a.batch) && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {a.program && <Chip label={a.program} tone="program" />}
          {a.batch && <Chip label={a.batch} tone="track" />}
        </div>
      )}

      {a.permalink && (
        <div className="mt-2.5">
          <a
            href={a.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
          >
            <MessageSquare size={11} /> Slack
          </a>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-1.5 border-t border-border pt-2.5">
        {a.raised_by && (
          <span className="text-[11px] text-muted">
            Raised by <span className="font-medium text-fg/70">{a.raised_by}</span>
          </span>
        )}
        <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 truncate text-xs">
          <span className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-accent-soft text-[10px] font-semibold text-accent">
            {a.assignee ? (a.assignee.full_name ?? a.assignee.email)[0]?.toUpperCase() : "?"}
          </span>
          <span className="truncate font-medium text-fg/80">
            {a.assignee ? (a.assignee.full_name ?? a.assignee.email) : "Unassigned"}
          </span>
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onMove(a, -1)}
            disabled={moving || STATUSES.indexOf(a.status) === 0}
            className="grid h-6 w-6 place-items-center rounded text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-25"
            aria-label="Move back"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => onMove(a, 1)}
            disabled={moving || STATUSES.indexOf(a.status) === STATUSES.length - 1}
            className="grid h-6 w-6 place-items-center rounded text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-25"
            aria-label="Move forward"
          >
            <ChevronRight size={14} />
          </button>
        </div>
        </div>
      </div>
    </article>
  );
}

// Unified chip. Uses a small semantic dot on a neutral background so many chips
// can sit next to each other without competing for attention.
const CHIP_DOT: Record<"program" | "track" | "tag" | "metric", string> = {
  program: "bg-pink-500",
  track: "bg-teal-500",
  tag: "bg-violet-500",
  metric: "bg-cyan-500",
};

function Chip({
  label,
  tone,
}: {
  label: string;
  tone: "program" | "track" | "tag" | "metric";
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-fg/80">
      <span className={`h-1.5 w-1.5 rounded-full ${CHIP_DOT[tone]}`} />
      {label}
    </span>
  );
}
