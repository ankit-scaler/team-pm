import { ExternalLink } from "lucide-react";
import type { AdhocRequest } from "@/lib/types";

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="whitespace-pre-line text-sm text-fg">{value}</div>
    </div>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function AdhocList({ requests }: { requests: AdhocRequest[] }) {
  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
        <p className="text-sm font-medium text-fg">No adhoc requests yet</p>
        <p className="mt-1 text-sm text-muted">
          New requests posted in #instructor-adhoc-request-1 will appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {requests.map((r) => (
        <div key={r.id} className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-fg">
                {r.program ?? "Adhoc request"}
                {r.batch ? <span className="font-normal text-muted"> · {r.batch}</span> : null}
              </div>
              {r.raised_by && (
                <div className="text-xs text-muted">
                  Raised by <span className="font-medium text-fg">{r.raised_by}</span>
                  {r.posted_at ? ` · ${fmtDate(r.posted_at)}` : ""}
                </div>
              )}
            </div>
            {r.permalink && (
              <a
                href={r.permalink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted transition-colors hover:text-fg"
              >
                <ExternalLink size={12} /> Slack
              </a>
            )}
          </div>

          <div className="space-y-3">
            <Field label="Module" value={r.module} />
            <Field label="Problem / scope" value={r.problem} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Who benefits" value={r.beneficiary} />
              <Field label="Learners impacted" value={r.learners_impact} />
            </div>
            <Field label="Risk if not done" value={r.risk_if_not_done} />
            <Field label="Outcome to track" value={r.outcome} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Module owner" value={r.module_owner} />
              <Field label="Stakeholder" value={r.stakeholder} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
