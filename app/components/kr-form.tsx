"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { createKR, updateKR } from "../(app)/actions";
import { Loader } from "./loader";
import type { KR } from "@/lib/kr-defaults";

const fieldCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg outline-none transition-colors focus:border-accent hover:border-border-strong";
const labelCls = "mb-1 block text-[12px] font-medium text-fg";

export function KRForm({ kr }: { kr?: KR }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(kr);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const action = isEdit ? updateKR.bind(null, kr!.id) : createKR;
    startTransition(async () => {
      try {
        await action(fd);
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <>
      {isEdit ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          aria-label={`Edit ${kr!.code}`}
          title={`Edit ${kr!.code}`}
        >
          <Pencil size={15} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 hover:shadow"
        >
          <Plus size={16} /> Add KR
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
              <h2 className="text-base font-semibold">{isEdit ? "Edit KR" : "Add KR"}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-bg hover:text-fg"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-3.5">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Code</label>
                  <input name="code" required defaultValue={kr?.code ?? ""} placeholder="KR 8 / GP 3" className={fieldCls} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Name</label>
                  <input name="name" required defaultValue={kr?.name ?? ""} placeholder="Short KR name" className={fieldCls} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Type</label>
                  <select name="metric_type" defaultValue={kr?.metricType ?? "Leading"} className={fieldCls}>
                    <option value="Leading">Leading</option>
                    <option value="Lagging">Lagging</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Section</label>
                  <select name="section" defaultValue={kr?.section ?? "kr"} className={fieldCls}>
                    <option value="kr">KR</option>
                    <option value="good-practice">Good Practice</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Valid for</label>
                  <input name="valid_for" defaultValue={kr?.validFor ?? "Instructor Team"} className={fieldCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Points (one per line)</label>
                <textarea
                  name="points"
                  rows={6}
                  defaultValue={kr?.points.join("\n") ?? ""}
                  placeholder={"One bullet per line…\nEach line becomes a bullet point."}
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
                  {pending ? "Saving…" : isEdit ? "Save changes" : "Add KR"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
