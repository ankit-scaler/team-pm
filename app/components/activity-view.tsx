"use client";

import { useMemo, useState } from "react";
import type { ActivityEntry } from "@/lib/queries";

const selCls = "rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm outline-none";
const openCalendar = (e: React.MouseEvent<HTMLInputElement>) =>
  (e.currentTarget as any).showPicker?.();

const ACTION_STYLE: Record<string, string> = {
  created: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300",
  updated: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300",
  moved: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
  deleted: "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300",
};

const ENTITY_TYPES = ["task", "adhoc", "kr", "metric", "tag", "effort", "priority", "program", "track", "membership", "role", "user"];
const ACTIONS = ["created", "updated", "moved", "deleted"];

function fmtWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ActivityView({ entries }: { entries: ActivityEntry[] }) {
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");

  const actors = useMemo(
    () => Array.from(new Set(entries.map((e) => e.actorName))).sort((a, b) => a.localeCompare(b)),
    [entries]
  );

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (actor && e.actorName !== actor) return false;
      if (action && e.action !== action) return false;
      if (entity && e.entityType !== entity) return false;
      const day = e.createdAt.slice(0, 10); // YYYY-MM-DD
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (q) {
        const hay = [e.summary, e.actorName, e.entityLabel, e.program, e.entityType]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [entries, actor, action, entity, from, to, q]);

  const anyFilter = actor || action || entity || from || to || q;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search activity…"
          className="min-w-[160px] flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
        <select value={actor} onChange={(e) => setActor(e.target.value)} className={selCls}>
          <option value="">Anyone</option>
          {actors.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select value={action} onChange={(e) => setAction(e.target.value)} className={selCls}>
          <option value="">All actions</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select value={entity} onChange={(e) => setEntity(e.target.value)} className={selCls}>
          <option value="">All types</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">Between</span>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} onClick={openCalendar} className={`${selCls} cursor-pointer`} />
        <span className="text-muted">and</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} onClick={openCalendar} className={`${selCls} cursor-pointer`} />
        {anyFilter && (
          <button
            type="button"
            onClick={() => {
              setActor(""); setAction(""); setEntity(""); setFrom(""); setTo(""); setQ("");
            }}
            className="text-xs text-accent hover:underline"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-muted">
          {filtered.length} of {entries.length}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">No activity matches these filters.</p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                <span
                  className={`inline-flex w-16 justify-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ACTION_STYLE[e.action] ?? "border-border bg-surface-2 text-muted"}`}
                >
                  {e.action}
                </span>
                <span className="rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                  {e.entityType}
                </span>
                <span className="min-w-[200px] flex-1 text-[13px] text-fg">{e.summary}</span>
                {e.program && (
                  <span className="rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">
                    {e.program}
                  </span>
                )}
                <span className="text-xs font-medium text-fg/70">{e.actorName}</span>
                <span className="w-[110px] text-right text-[11px] text-muted">{fmtWhen(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
