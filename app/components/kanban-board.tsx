"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, MessageSquare, FileSpreadsheet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { changeStatus } from "../(app)/actions";
import { TaskForm } from "./task-form";
import { PriorityLabel, EffortChip } from "./status-badge";
import {
  STATUSES,
  STATUS_STYLES,
  STAGE_ACCENT,
  cardTint,
  type Profile,
  type Status,
  type Task,
} from "@/lib/types";

function isDelayed(t: Task) {
  return t.status === "Completed" && t.eta && t.delivered_date && t.delivered_date > t.eta;
}

function fmt(d: string | null) {
  if (!d) return null;
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function KanbanBoard({
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
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [assignee, setAssignee] = useState("");
  const [tag, setTag] = useState("");
  const [q, setQ] = useState("");

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
      if (q && !t.title.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [tasks, assignee, tag, q]);

  const anyFilter = assignee || tag || q;

  function move(task: Task, dir: -1 | 1) {
    const idx = STATUSES.indexOf(task.status);
    const next = STATUSES[idx + dir];
    if (!next) return;
    startTransition(() => changeStatus(task.id, next as Status));
  }

  const selCls = "rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm outline-none";

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
          return (
            <section key={col} className="flex flex-col rounded-xl border border-border bg-surface/50">
              <header className="flex items-center justify-between border-b border-border px-3 py-2.5">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[col]}`}>
                  {col}
                </span>
                <span className="text-xs text-muted">{items.length}</span>
              </header>

              <div className="flex-1 space-y-2 p-2">
                {items.length === 0 && (
                  <p className="px-1 py-6 text-center text-xs text-muted">Nothing here</p>
                )}
                {items.map((t) => (
                  <article
                    key={t.id}
                    className={`group rounded-lg border border-l-4 border-border ${STAGE_ACCENT[col]} ${cardTint(col, t.id)} p-3 shadow-sm`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold leading-snug text-fg">{t.title}</h3>
                      <div className="opacity-0 transition-opacity group-hover:opacity-100">
                        <TaskForm people={people} task={t} allTags={allTags} allMetrics={allMetrics} />
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <PriorityLabel priority={t.priority} />
                      <EffortChip effort={t.effort} />
                      {t.eta && (
                        <span className="text-xs font-medium text-muted">ETA {fmt(t.eta)}</span>
                      )}
                      {t.status === "Completed" && t.delivered_date && (
                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          Delivered {fmt(t.delivered_date)}
                        </span>
                      )}
                      {isDelayed(t) && (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700 dark:bg-red-950 dark:text-red-300">
                          Delayed
                        </span>
                      )}
                    </div>

                    {t.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {t.tags.map((tg) => (
                          <span
                            key={tg}
                            className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                          >
                            #{tg}
                          </span>
                        ))}
                      </div>
                    )}

                    {t.metrics.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {t.metrics.map((m) => (
                          <span
                            key={m}
                            className="rounded-full bg-cyan-100 px-1.5 py-0.5 text-[11px] font-medium text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    )}

                    {(t.slack_link || t.sheet_link) && (
                      <div className="mt-2 flex items-center gap-3">
                        {t.slack_link && (
                          <a
                            href={t.slack_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
                          >
                            <MessageSquare size={12} /> Slack
                          </a>
                        )}
                        {t.sheet_link && (
                          <a
                            href={t.sheet_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
                          >
                            <FileSpreadsheet size={12} /> Sheet
                          </a>
                        )}
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-between">
                      <span className="truncate text-xs font-medium text-muted">
                        {t.assignee ? (t.assignee.full_name ?? t.assignee.email) : "Unassigned"}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => move(t, -1)}
                          disabled={STATUSES.indexOf(t.status) === 0}
                          className="grid h-6 w-6 place-items-center rounded text-muted hover:bg-bg hover:text-fg disabled:opacity-30"
                          aria-label="Move back"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(t, 1)}
                          disabled={STATUSES.indexOf(t.status) === STATUSES.length - 1}
                          className="grid h-6 w-6 place-items-center rounded text-muted hover:bg-bg hover:text-fg disabled:opacity-30"
                          aria-label="Move forward"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
