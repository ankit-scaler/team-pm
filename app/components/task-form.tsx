"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { createTask, updateTask, deleteTask } from "../(app)/actions";
import { StakeholderSelect } from "./stakeholder-select";
import { TagSelect } from "./tag-select";
import { STATUSES, EFFORTS, PRIORITIES, type Profile, type Task } from "@/lib/types";

const fieldCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent";
const labelCls = "mb-1 block text-xs font-medium text-muted";

export function TaskForm({
  people,
  task,
  allTags = [],
}: {
  people: Profile[];
  task?: Task;
  allTags?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(task);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const action = isEdit ? updateTask.bind(null, task!.id) : createTask;
    startTransition(async () => {
      try {
        await action(fd);
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function onDelete() {
    if (!task || !confirm("Delete this task? This can't be undone.")) return;
    startTransition(async () => {
      await deleteTask(task.id);
      setOpen(false);
    });
  }

  return (
    <>
      {isEdit ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="grid h-8 w-8 place-items-center rounded-md text-muted transition-colors hover:bg-bg hover:text-fg"
          aria-label="Edit task"
        >
          <Pencil size={15} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          <Plus size={16} /> New task
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-40 grid place-items-start overflow-y-auto bg-black/40 p-4 backdrop-blur-sm sm:place-items-center"
          onMouseDown={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-border bg-surface p-5 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">{isEdit ? "Edit task" : "New task"}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-bg hover:text-fg"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-3">
              <div>
                <label className={labelCls}>Title</label>
                <input
                  name="title"
                  required
                  defaultValue={task?.title ?? ""}
                  placeholder="What needs doing?"
                  className={fieldCls}
                />
              </div>

              <div>
                <label className={labelCls}>Description</label>
                <textarea
                  name="description"
                  rows={3}
                  defaultValue={task?.description ?? ""}
                  placeholder="Context, links, acceptance criteria…"
                  className={fieldCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Assignee (picked by)</label>
                  <select name="assignee_id" defaultValue={task?.assignee_id ?? ""} className={fieldCls}>
                    <option value="">Unassigned</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name ?? p.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select name="status" defaultValue={task?.status ?? "To pick"} className={fieldCls}>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Priority</label>
                  <select name="priority" defaultValue={task?.priority ?? "Medium"} className={fieldCls}>
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Effort</label>
                  <select name="effort" defaultValue={task?.effort ?? ""} className={fieldCls}>
                    <option value="">—</option>
                    {EFFORTS.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>ETA</label>
                  <input
                    type="date"
                    name="eta"
                    defaultValue={task?.eta ?? ""}
                    onClick={(e) => (e.currentTarget as any).showPicker?.()}
                    className={`${fieldCls} cursor-pointer`}
                  />
                </div>
                <div>
                  <label className={labelCls}>Delivered date</label>
                  <input
                    type="date"
                    name="delivered_date"
                    defaultValue={task?.delivered_date ?? ""}
                    onClick={(e) => (e.currentTarget as any).showPicker?.()}
                    className={`${fieldCls} cursor-pointer`}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Stakeholders</label>
                <StakeholderSelect
                  people={people}
                  defaultSelectedIds={task?.stakeholders?.map((s) => s.id) ?? []}
                />
              </div>

              <div>
                <label className={labelCls}>Tags</label>
                <TagSelect suggestions={allTags} defaultTags={task?.tags ?? []} />
              </div>

              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

              <div className="flex items-center justify-between pt-2">
                {isEdit ? (
                  <button
                    type="button"
                    onClick={onDelete}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                  >
                    <Trash2 size={15} /> Delete
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-fg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {pending ? "Saving…" : isEdit ? "Save changes" : "Create task"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
