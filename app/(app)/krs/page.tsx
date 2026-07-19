import { getKRs } from "@/lib/queries";
import { getMyAccess } from "@/lib/access";
import type { KR } from "@/lib/kr-defaults";
import { KRForm } from "../../components/kr-form";
import { KRDeleteButton } from "../../components/kr-delete-button";

export const dynamic = "force-dynamic";

const METRIC_STYLE: Record<string, string> = {
  Leading: "text-blue-700 dark:text-blue-300",
  Lagging: "text-purple-700 dark:text-purple-300",
};

export default async function KRsPage() {
  const [all, access] = await Promise.all([getKRs(), getMyAccess()]);
  const isAdmin = access.isAdmin;
  const krs = all.filter((k) => k.section !== "good-practice");
  const goodPractices = all.filter((k) => k.section === "good-practice");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">KR Framework — Instructor Team</h1>
          <p className="text-sm text-muted">Key Results and good practices for the current cycle.</p>
        </div>
        {isAdmin && <KRForm />}
      </div>

      {/* ── KRs ── */}
      <div className="space-y-4">
        {krs.map((kr) => (
          <KRCard key={kr.id} kr={kr} isAdmin={isAdmin} />
        ))}
      </div>

      {/* ── Good Practices ── */}
      {goodPractices.length > 0 && (
        <>
          <div className="pt-2">
            <h2 className="text-base font-semibold tracking-tight text-fg">Good Practices</h2>
            <p className="text-sm text-muted">Recommended practices to maintain alongside KRs.</p>
          </div>
          <div className="space-y-4">
            {goodPractices.map((kr) => (
              <KRCard key={kr.id} kr={kr} isAdmin={isAdmin} />
            ))}
          </div>
        </>
      )}

      {all.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-sm text-muted">
          No KRs yet.{isAdmin ? " Add one with “Add KR”." : ""}
        </div>
      )}
    </div>
  );
}

function KRCard({ kr, isAdmin }: { kr: KR; isAdmin: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="rounded-md bg-accent px-2 py-0.5 text-[11px] font-bold tracking-wide text-white">
            {kr.code}
          </span>
          <h3 className="text-base font-semibold text-fg">{kr.name}</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-0.5 text-[11px] font-semibold ${METRIC_STYLE[kr.metricType] ?? ""}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${kr.metricType === "Leading" ? "bg-blue-500" : "bg-purple-500"}`} />
            {kr.metricType}
          </span>
          <span className="rounded-md border border-border bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">
            {kr.validFor}
          </span>
          {isAdmin && <KRDeleteButton id={kr.id} code={kr.code} />}
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {kr.points.map((point, i) => (
          <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-fg/85">
            <span className="mt-[7px] h-1 w-1 flex-shrink-0 rounded-full bg-accent" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
