"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { changeStatus } from "../(app)/actions";
import { TaskForm } from "./task-form";
import { PriorityLabel, EffortChip } from "./status-badge";
import { STATUSES, STATUS_STYLES, type Profile, type Status, type Task } from "@/lib/types";

function fmt(d: string | null) {
  if (!d) return null;
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function KanbanBoard({ tasks, people }: { tasks: Task[]; people: Profile[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

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

  function move(task: Task, dir: -1 | 1) {
    const idx = STATUSES.indexOf(task.status);
    const next = STATUSES[idx + dir];
    if (!next) return;
    startTransition(() => changeStatus(task.id, next as Status));
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {STATUSES.map((col) => {
        const items = tasks.filter((t) => t.status === col);
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
                  className="group rounded-lg border border-border bg-surface p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-medium leading-snug">{t.title}</h3>
                    <div className="opacity-0 transition-opacity group-hover:opacity-100">
                      <TaskForm people={people} task={t} />
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <PriorityLabel priority={t.priority} />
                    <EffortChip effort={t.effort} />
                    {t.eta && (
                      <span className="text-xs text-muted">ETA {fmt(t.eta)}</span>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="truncate text-xs text-muted">
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
  );
}
