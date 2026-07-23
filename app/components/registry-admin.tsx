"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  createProgram,
  createTrack,
  createMetric,
  createTag,
  createEffort,
  createPriority,
} from "../(app)/actions";

// Admin-only: add new values to the lists that feed every picker in the app.
export function RegistryAdmin({
  programs,
  tracks,
  metrics,
  tags,
  efforts,
  priorities,
}: {
  programs: string[];
  tracks: string[];
  metrics: string[];
  tags: string[];
  efforts: string[];
  priorities: string[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Section title="Programs" singular="program" items={programs} onAdd={createProgram} />
      <Section title="Tracks" singular="track" items={tracks} onAdd={createTrack} />
      <Section title="Metrics" singular="metric" items={metrics} onAdd={createMetric} />
      <Section title="Tags" singular="tag" items={tags} onAdd={createTag} />
      <Section title="Effort levels" singular="effort" items={efforts} onAdd={createEffort} />
      <Section title="Priorities" singular="priority" items={priorities} onAdd={createPriority} />
    </div>
  );
}

function Section({
  title,
  singular,
  items,
  onAdd,
}: {
  title: string;
  singular: string;
  items: string[];
  onAdd: (name: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function add() {
    const v = value.trim();
    if (!v) return;
    setError(null);
    startTransition(async () => {
      try {
        await onAdd(v);
        setValue("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not add");
      }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {items.length === 0 ? (
          <span className="text-xs text-muted">None yet</span>
        ) : (
          items.map((i) => (
            <span
              key={i}
              className="rounded-md border border-border bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-fg/80"
            >
              {i}
            </span>
          ))
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={`Add a ${singular}…`}
          className="flex-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent"
        />
        <button
          type="button"
          disabled={pending || !value.trim()}
          onClick={add}
          className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Plus size={15} /> Add
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
