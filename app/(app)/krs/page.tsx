export const dynamic = "force-dynamic";

// Static KR data. Edit this list to update the KRs page — no migration needed.
const KRS = [
  { id: "KR1", name: "Increase I2H by 10% across all programs", target: "10%", current: "—", status: "On track" },
  { id: "KR2", name: "Maintain NPS above 70 for all tracks", target: "70+", current: "—", status: "On track" },
  { id: "KR3", name: "Achieve 90% class rating across Academy", target: "90%", current: "—", status: "At risk" },
  { id: "KR4", name: "Launch 5 new modules in DSML track", target: "5", current: "—", status: "On track" },
  { id: "KR5", name: "Reduce cue card rating below-avg to < 5%", target: "< 5%", current: "—", status: "Behind" },
  { id: "KR6", name: "Complete PSP reviews for 100% of cohorts", target: "100%", current: "—", status: "On track" },
];

const STATUS_COLOR: Record<string, string> = {
  "On track": "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "At risk": "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  Behind: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export default function KRsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">KRs</h1>
        <p className="text-sm text-muted">
          Key Results for the current cycle. To update, edit the KRS array in{" "}
          <code className="rounded bg-bg px-1 py-0.5 text-xs font-mono">app/(app)/krs/page.tsx</code>.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">#</th>
              <th className="px-4 py-2.5 font-medium">Key Result</th>
              <th className="px-4 py-2.5 text-center font-medium">Target</th>
              <th className="px-4 py-2.5 text-center font-medium">Current</th>
              <th className="px-4 py-2.5 text-center font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {KRS.map((kr) => (
              <tr key={kr.id} className="border-b border-border last:border-0 hover:bg-bg/60">
                <td className="px-4 py-3 font-bold text-accent">{kr.id}</td>
                <td className="px-4 py-3 font-medium text-fg">{kr.name}</td>
                <td className="px-4 py-3 text-center font-semibold">{kr.target}</td>
                <td className="px-4 py-3 text-center font-semibold">{kr.current}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_COLOR[kr.status] ?? "bg-slate-100 text-slate-600"}`}>
                    {kr.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted">
        This is a static page — KR data is defined in code, not in the database.
        Edit the file, commit, and push to update the numbers.
      </p>
    </div>
  );
}
