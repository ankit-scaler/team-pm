"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { createAdhocRequest, updateAdhocRequest } from "../(app)/actions";
import { Loader } from "./loader";
import { PROGRAMS, STATUSES, type AdhocRequest } from "@/lib/types";

const fieldCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg outline-none transition-colors focus:border-accent hover:border-border-strong";
const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted";

export function AdhocForm({
  variant = "solid",
  request,
  triggerClassName,
  allowedPrograms = PROGRAMS as unknown as string[],
}: {
  variant?: "solid" | "outline";
  request?: AdhocRequest;
  triggerClassName?: string;
  allowedPrograms?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(request);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const action = isEdit ? updateAdhocRequest.bind(null, request!.id) : createAdhocRequest;
    startTransition(async () => {
      try {
        await action(fd);
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  const solidCls =
    "inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 hover:shadow";
  const outlineCls =
    "inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-semibold text-fg transition-colors hover:border-border-strong hover:bg-surface-2";

  return (
    <>
      {isEdit ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={
            triggerClassName ??
            "grid h-8 w-8 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          }
          aria-label="Edit adhoc request"
        >
          <Pencil size={15} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={variant === "solid" ? solidCls : outlineCls}
        >
          <Plus size={16} /> Adhoc
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
              <h2 className="text-base font-semibold">
                {isEdit ? "Edit adhoc request" : "New adhoc request"}
              </h2>
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
                  defaultValue={request?.title ?? ""}
                  placeholder="Short summary of the request"
                  className={fieldCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Status</label>
                  <select name="status" defaultValue={request?.status ?? "To pick"} className={fieldCls}>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>ETA</label>
                  <input
                    type="date"
                    name="eta"
                    defaultValue={request?.eta ?? ""}
                    onClick={(e) => (e.currentTarget as any).showPicker?.()}
                    className={`${fieldCls} cursor-pointer`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Program</label>
                  <select name="program" defaultValue={request?.program ?? ""} className={fieldCls}>
                    <option value="">—</option>
                    {allowedPrograms.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Batch</label>
                  <input name="batch" defaultValue={request?.batch ?? ""} placeholder="e.g. Academy Aug25 Beginner FE" className={fieldCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Module</label>
                <input name="module" defaultValue={request?.module ?? ""} placeholder="Which module are we solving for?" className={fieldCls} />
              </div>

              <div>
                <label className={labelCls}>What problem are we solving?</label>
                <textarea name="problem" rows={3} defaultValue={request?.problem ?? ""} placeholder="Context / scope…" className={fieldCls} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Who benefits</label>
                  <input name="beneficiary" defaultValue={request?.beneficiary ?? ""} placeholder="e.g. Learners" className={fieldCls} />
                </div>
                <div>
                  <label className={labelCls}>Learners impacted</label>
                  <input name="learners_impact" defaultValue={request?.learners_impact ?? ""} placeholder="e.g. 100+" className={fieldCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Risk if not done</label>
                <input name="risk_if_not_done" defaultValue={request?.risk_if_not_done ?? ""} placeholder="What happens if we skip this?" className={fieldCls} />
              </div>

              <div>
                <label className={labelCls}>Outcome to track</label>
                <input name="outcome" defaultValue={request?.outcome ?? ""} placeholder="e.g. Class rating" className={fieldCls} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Module owner (reviewer)</label>
                  <input name="module_owner" defaultValue={request?.module_owner ?? ""} placeholder="Name" className={fieldCls} />
                </div>
                <div>
                  <label className={labelCls}>Stakeholder</label>
                  <input name="stakeholder" defaultValue={request?.stakeholder ?? ""} placeholder="Name" className={fieldCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Slack link (optional)</label>
                <input
                  type="url"
                  name="slack_link"
                  defaultValue={request?.permalink ?? ""}
                  placeholder="https://slack.com/… (link to the relevant thread)"
                  className={fieldCls}
                />
              </div>

              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
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
                  {pending ? "Saving…" : isEdit ? "Save changes" : "Add request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
