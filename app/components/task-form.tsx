"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { createTask, updateTask, deleteTask, deleteMetric } from "../(app)/actions";
import { StakeholderSelect } from "./stakeholder-select";
import { TagSelect } from "./tag-select";
import { Loader } from "./loader";
import { STATUSES, type Profile, type Task } from "@/lib/types";

const fieldCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg outline-none transition-colors focus:border-accent hover:border-border-strong";
const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted";
const Req = () => <span className="text-red-500"> *</span>;

export function TaskForm({
  people,
  task,
  allTags = [],
  allMetrics = [],
  allowedPrograms = [],
  tracks = [],
  efforts = [],
  priorities = [],
  canCreateMetrics = false,
}: {
  people: Profile[];
  task?: Task;
  allTags?: string[];
  allMetrics?: string[];
  allowedPrograms?: string[];
  tracks?: string[];
  efforts?: string[];
  priorities?: string[];
  canCreateMetrics?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [etaTbd, setEtaTbd] = useState(task?.eta_tbd ?? false);
  const router = useRouter();
  const isEdit = Boolean(task);

  function onDeleteMetric(name: string) {
    if (!confirm(`Delete the metric “${name}” everywhere?\nIt will be removed from every task and adhoc request.`))
      return;
    startTransition(async () => {
      await deleteMetric(name);
      router.refresh();
    });
  }

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
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 hover:shadow"
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
            className="relative w-full max-w-lg rounded-xl border border-border bg-surface p-5 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {pending && (
              <div className="absolute inset-0 z-10 grid place-items-center rounded-xl bg-surface/85 backdrop-blur-sm">
                <Loader className="py-0" />
              </div>
            )}
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
                <label className={labelCls}>Title<Req /></label>
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
                  <label className={labelCls}>Assignee (picked by)<Req /></label>
                  <select name="assignee_id" required defaultValue={task?.assignee_id ?? ""} className={fieldCls}>
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
                  <label className={labelCls}>Priority<Req /></label>
                  <select name="priority" defaultValue={task?.priority ?? "Medium"} className={fieldCls}>
                    {priorities.map((p) => (
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
                    {efforts.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Program<Req /></label>
                  <select name="program" required defaultValue={task?.program ?? ""} className={fieldCls}>
                    <option value="">—</option>
                    {allowedPrograms.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Track<Req /></label>
                  <select name="track" required defaultValue={task?.track ?? ""} className={fieldCls}>
                    <option value="">—</option>
                    {tracks.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>ETA<Req /></label>
                  <input
                    type="date"
                    name="eta"
                    required={!etaTbd}
                    disabled={etaTbd}
                    defaultValue={task?.eta ?? ""}
                    onClick={(e) => (e.currentTarget as any).showPicker?.()}
                    className={`${fieldCls} cursor-pointer disabled:opacity-50`}
                  />
                  <label className="mt-1.5 flex items-center gap-1.5 text-[11px] font-normal normal-case text-muted">
                    <input
                      type="checkbox"
                      name="eta_tbd"
                      checked={etaTbd}
                      onChange={(e) => setEtaTbd(e.target.checked)}
                    />
                    To be decided
                  </label>
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
                <label className={labelCls}>
                  Tags{!canCreateMetrics && <span className="ml-1 font-normal normal-case text-muted">(select from list)</span>}
                </label>
                <TagSelect
                  suggestions={allTags}
                  defaultTags={task?.tags ?? []}
                  allowCreate={canCreateMetrics}
                  placeholder={canCreateMetrics ? "Add tags…" : "Select tags…"}
                />
              </div>

              <div>
                <label className={labelCls}>
                  Metrics<Req />
                  {!canCreateMetrics && <span className="ml-1 font-normal text-muted">(select from list)</span>}
                </label>
                <TagSelect
                  suggestions={allMetrics}
                  defaultTags={task?.metrics ?? []}
                  fieldName="metrics"
                  placeholder={canCreateMetrics ? "Select or add metrics…" : "Select metrics…"}
                  prefix=""
                  allowCreate={canCreateMetrics}
                  onDelete={canCreateMetrics ? onDeleteMetric : undefined}
                  chipClass="bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300 hover:bg-cyan-200/60 dark:hover:bg-cyan-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Slack link (optional)</label>
                  <input
                    type="url"
                    name="slack_link"
                    defaultValue={task?.slack_link ?? ""}
                    placeholder="https://slack.com/…"
                    className={fieldCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Relevant sheet (optional)</label>
                  <input
                    type="url"
                    name="sheet_link"
                    defaultValue={task?.sheet_link ?? ""}
                    placeholder="https://docs.google.com/…"
                    className={fieldCls}
                  />
                </div>
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
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 hover:shadow disabled:opacity-60"
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
