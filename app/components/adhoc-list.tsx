"use client";

import { useMemo, useState } from "react";
import { MessageSquare, Slack } from "lucide-react";
import { StatusBadge } from "./status-badge";
import { AdhocDeleteButton } from "./adhoc-delete-button";
import { AdhocForm } from "./adhoc-form";
import { PROGRAMS, type AdhocRequest, type Profile } from "@/lib/types";

const selCls = "rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm outline-none";

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function displayTitle(r: AdhocRequest) {
  return r.title || r.module || r.program || "Adhoc request";
}

export function AdhocList({ requests, people = [] }: { requests: AdhocRequest[]; people?: Profile[] }) {
  const [q, setQ] = useState("");
  const [program, setProgram] = useState("");
  const [source, setSource] = useState("");
  const [assignee, setAssignee] = useState("");

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (program && r.program !== program) return false;
      if (source && r.source !== source) return false;
      if (assignee === "unassigned" ? r.assignee_id : assignee && r.assignee_id !== assignee)
        return false;
      if (q) {
        const hay = [r.title, r.module, r.problem, r.raised_by, r.batch, r.module_owner, r.stakeholder,
          r.assignee?.full_name, r.assignee?.email]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [requests, q, program, source, assignee]);

  const anyFilter = q || program || source || assignee;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search requests…"
          className="min-w-[160px] flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
        <select value={program} onChange={(e) => setProgram(e.target.value)} className={selCls}>
          <option value="">All programs</option>
          {PROGRAMS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)} className={selCls}>
          <option value="">All sources</option>
          <option value="slack">From Slack</option>
          <option value="manual">Added manually</option>
        </select>
        {people.length > 0 && (
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={selCls}>
            <option value="">Anyone</option>
            <option value="unassigned">Unassigned</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>
            ))}
          </select>
        )}
        {anyFilter && (
          <button
            type="button"
            onClick={() => {
              setQ(""); setProgram(""); setSource(""); setAssignee("");
            }}
            className="text-xs text-accent hover:underline"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-muted">
          {filtered.length} of {requests.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-2/40 text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Request</th>
              <th className="px-4 py-3 font-semibold">Benefits</th>
              <th className="px-4 py-3 font-semibold">Learners</th>
              <th className="px-4 py-3 font-semibold">Assignee</th>
              <th className="px-4 py-3 font-semibold">Stakeholder</th>
              <th className="px-4 py-3 font-semibold">Raised by</th>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted">
                  {requests.length === 0
                    ? "No adhoc requests yet. Add one with “+ Adhoc”, or they’ll appear here from #instructor-adhoc-request-1."
                    : "No requests match these filters."}
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 align-top transition-colors hover:bg-surface-2/40">
                <td className="max-w-md px-4 py-3">
                  <div className="text-[13px] font-semibold text-fg">{displayTitle(r)}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    <StatusBadge status={r.status} />
                    <SourceBadge source={r.source} />
                    {needsTriage(r) && <TriageBadge />}
                    {r.program && <Chip label={r.program} tone="program" />}
                    {r.batch && <Chip label={r.batch} tone="track" />}
                  </div>
                  {r.module && r.module !== displayTitle(r) && (
                    <div className="mt-1 text-xs text-muted">{r.module}</div>
                  )}
                  {r.problem && (
                    <div className="mt-1 line-clamp-2 whitespace-pre-line text-xs text-muted">{r.problem}</div>
                  )}
                  {r.permalink && (
                    <div className="mt-1.5">
                      <a
                        href={r.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
                      >
                        <MessageSquare size={11} /> Open in Slack
                      </a>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-muted">{r.beneficiary ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{r.learners_impact ?? "—"}</td>
                <td className="px-4 py-3">
                  {r.assignee ? (
                    <span className="text-sm" title={r.assignee.email}>{r.assignee.full_name ?? r.assignee.email}</span>
                  ) : r.module_owner ? (
                    <span className="text-sm">{r.module_owner}</span>
                  ) : (
                    <span className="text-xs text-muted">Unassigned</span>
                  )}
                </td>
                <td className="px-4 py-3">{r.stakeholder ?? <span className="text-muted">—</span>}</td>
                <td className="px-4 py-3 text-muted">{r.raised_by ?? "—"}</td>
                <td className="px-4 py-3 text-muted">
                  {fmt(r.posted_at ?? r.created_at)}
                  {r.eta && <div className="text-[11px]">ETA {fmt(r.eta)}</div>}
                  {r.status === "Completed" && r.delivered_date && (
                    <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                      Delivered {fmt(r.delivered_date)}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <AdhocForm request={r} people={people} />
                    <AdhocDeleteButton id={r.id} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// A Slack-fed request arrives without an ETA, so it's incomplete until someone
// edits it to add one.
export function needsTriage(r: AdhocRequest): boolean {
  return r.source === "slack" && !r.eta;
}

function TriageBadge() {
  return (
    <span className="inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
      Incomplete
    </span>
  );
}

function SourceBadge({ source }: { source: "slack" | "manual" }) {
  return source === "slack" ? (
    <span className="inline-flex items-center gap-1 rounded-md border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[11px] font-medium text-accent">
      <Slack size={10} /> Slack
    </span>
  ) : (
    <span className="inline-flex items-center rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-fg/80">
      Manual
    </span>
  );
}

const DOT: Record<"program" | "track", string> = {
  program: "bg-pink-500",
  track: "bg-teal-500",
};

function Chip({ label, tone }: { label: string; tone: "program" | "track" }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-fg/80">
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} />
      {label}
    </span>
  );
}
