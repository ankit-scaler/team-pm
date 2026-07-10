"use client";

import { useMemo, useState } from "react";
import type { Profile, Task } from "@/lib/types";

const inDateRange = (d: string | null, from: string, to: string) => {
  if (!d) return false;
  const day = d.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
};

export function PeopleReport({ tasks, people }: { tasks: Task[]; people: Profile[] }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [personId, setPersonId] = useState("");

  const rows = useMemo(() => {
    return people
      .filter((p) => !personId || p.id === personId)
      .map((p) => {
        const mine = tasks.filter((t) => t.assignee_id === p.id);
        const picked = mine.filter((t) => inDateRange(t.picked_date, from, to)).length;
        const closed = mine.filter(
          (t) => t.status === "Completed" && inDateRange(t.delivered_date, from, to)
        ).length;
        return {
          profile: p,
          picked,
          closed,
          open: mine.filter((t) => t.status === "Working" || t.status === "In Review").length,
          toPick: mine.filter((t) => t.status === "To pick").length,
          total: mine.length,
        };
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.open - a.open || b.total - a.total);
  }, [tasks, people, from, to, personId]);

  const inputCls = "rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-fg outline-none transition-colors focus:border-accent hover:border-border-strong";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select
          value={personId}
          onChange={(e) => setPersonId(e.target.value)}
          className={inputCls}
        >
          <option value="">Everyone</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.email}</option>
          ))}
        </select>
        <span className="text-muted">Count picked / closed between</span>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} onClick={(e) => (e.currentTarget as any).showPicker?.()} className={`${inputCls} cursor-pointer`} />
        <span className="text-muted">and</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} onClick={(e) => (e.currentTarget as any).showPicker?.()} className={`${inputCls} cursor-pointer`} />
        {(from || to || personId) && (
          <button
            type="button"
            onClick={() => {
              setFrom("");
              setTo("");
              setPersonId("");
            }}
            className="text-xs text-accent hover:underline"
          >
            Clear
          </button>
        )}
        {!from && !to && <span className="text-xs text-muted">(all time)</span>}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-2/40 text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Person</th>
              <th className="px-4 py-3 text-center font-semibold">Picked</th>
              <th className="px-4 py-3 text-center font-semibold">Closed</th>
              <th className="px-4 py-3 text-center font-semibold">In progress</th>
              <th className="px-4 py-3 text-center font-semibold">To pick</th>
              <th className="px-4 py-3 text-center font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  No assigned tasks yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.profile.id} className="border-b border-border last:border-0 transition-colors hover:bg-surface-2/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {r.profile.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.profile.avatar_url} alt="" className="h-7 w-7 rounded-full border border-border" />
                    ) : (
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-accent/15 text-[11px] font-medium text-accent">
                        {(r.profile.full_name ?? r.profile.email)[0]?.toUpperCase()}
                      </span>
                    )}
                    <div>
                      <div className="font-medium leading-tight">{r.profile.full_name ?? "—"}</div>
                      <div className="text-xs leading-tight text-muted">{r.profile.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-center font-medium text-blue-600 dark:text-blue-400">{r.picked}</td>
                <td className="px-4 py-3 text-center font-medium text-emerald-600 dark:text-emerald-400">{r.closed}</td>
                <td className="px-4 py-3 text-center">{r.open}</td>
                <td className="px-4 py-3 text-center text-muted">{r.toPick}</td>
                <td className="px-4 py-3 text-center text-muted">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        “Picked” counts tasks whose work started (moved to Working) in the range. “Closed” counts tasks
        delivered in the range. Leave dates blank for all-time totals.
      </p>
    </div>
  );
}
