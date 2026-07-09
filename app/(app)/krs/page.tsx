export const dynamic = "force-dynamic";

// ─── KR Data ────────────────────────────────────────────────
// Edit this array to update the KRs page. No migration needed.
// Just change, commit, and push.

type KR = {
  id: string;
  name: string;
  validFor: string;
  metricType: "Leading" | "Lagging";
  points: string[];
  section?: "kr" | "good-practice";
};

const KRS: KR[] = [
  {
    id: "KR 1",
    name: "Module Ratings",
    validFor: "Instructor Team",
    metricType: "Leading",
    section: "kr",
    points: [
      "Module ratings should primarily reflect content quality and learning experience and should be evaluated separately from RI delivery impact.",
      "Evaluation should account for: Script quality, Assignment quality, Contest quality, AI assignment additions and integrations, Overall module flow and coherence.",
      "RI delivery impact should be handled through a separate improvement mechanism: Low RI ratings → Feedback → Training → Re-delivery → Re-evaluation.",
      "Average module ratings should be maintained in the range of 4.7–4.8.",
      "Introduce an incremental improvement tracking system to compare module performance against older batches and measure the impact of improvements.",
      "Module completion metrics should clearly define whether completion is considered before Shivank's final approval or after final review and closure.",
      "Additional metric: % of modules delivered within timelines after complete review and QA.",
    ],
  },
  {
    id: "KR 1a",
    name: "Retention in Class",
    validFor: "Instructor Team",
    metricType: "Leading",
    section: "kr",
    points: [
      "Learner retention should measure how consistently learners attend classes throughout the module lifecycle.",
      "Strong content quality and learning flow should directly contribute towards improved learner consistency and attendance.",
      "Factors affecting retention should be normalized before evaluation: Same number of classes across comparisons, RI impact to be isolated from content evaluation, Batch timing variations to be considered separately.",
      "Average attendance should not decrease due to content quality or poor learning flow.",
      "Build a structured learner feedback tagging system through a dedicated POC/agent to classify feedback into: Technical difficulty, Poor flow, Pace issues, Assignment difficulty, Lack of engagement, Delivery concerns.",
    ],
  },
  {
    id: "KR 3",
    name: "ETA / TAT of Deliverables",
    validFor: "Instructor Team",
    metricType: "Leading",
    section: "kr",
    points: [
      "Library-level or module-level changes should have clearly defined extended TATs compared to smaller operational changes.",
      "Introduce a structured review cycle for older content within a rolling 15–60 day review window.",
      "Content reviews and quality improvements should not be solely dependent on RIs, especially when such reviews are not directly linked to their incentives.",
      "Create a centralised ownership mechanism for: Script audits, Assignment audits, Contest reviews, AI integration checks.",
      "Existing review workflows currently managed manually by RIs should gradually move toward structured review ownership.",
    ],
  },
  {
    id: "KR 4",
    name: "Instructor-led Cue Card Rating",
    validFor: "Ankit Mishra",
    metricType: "Leading",
    section: "kr",
    points: [
      "Valid cue card feedback should be reviewed and approved by Module Owners before implementation.",
      "Cue cards should be continuously updated based on: Learner confusion points, Instructor feedback, Script mismatches, Delivery gaps.",
      "The primary objective should be to maintain minimal or zero low-rated cue cards.",
      "Build periodic audits to ensure: Cue cards are aligned with scripts, Learning objectives are maintained, Delivery quality remains standardized across instructors.",
    ],
  },
  {
    id: "KR 6",
    name: "NPS",
    validFor: "Instructor Team",
    metricType: "Lagging",
    section: "kr",
    points: [
      "NPS should be evaluated at a complete program level while isolating content-driven improvements separately. Overall program NPS should remain above 55.",
      "Scaler 3.0 impact should be tracked through: Before vs. after Scaler 3.0 comparisons, Module-level sentiment tracking, Learning experience improvements.",
      "Content-related feedback should be actively tagged and categorised into: Technical quality, Curriculum relevance, Content depth, AI integration quality, Assignment quality, Learning flow.",
      "Cross-functional recommendations should be actively shared with relevant teams wherever trends are identified (e.g., Placement readiness gaps → Placement Team, Interview communication gaps → Program Team, Assignment overload → Curriculum Team).",
    ],
  },
  {
    id: "KR 7",
    name: "AI Judges",
    validFor: "Instructor Team + Ankit",
    metricType: "Leading",
    section: "kr",
    points: [
      "Ensure all judges are thoroughly tested before rollout. Any implications mean we would be accountable for the learner experience.",
      "Across all judges, move the adherence to 120 unique learners experiencing it.",
      "Based on the feedback of various judges, we may also need to improvise the curriculum.",
    ],
  },
  {
    id: "GP 1",
    name: "AI-Native Curriculum Adoption",
    validFor: "Instructor Team",
    metricType: "Leading",
    section: "good-practice",
    points: [
      "Track adoption and quality of AI-native additions across programs.",
      "Ensure AI integrations are not treated as add-on modules but embedded into the learning journey.",
      "Review: AI assignment quality, AI project relevance, AI interview preparedness, AI workflow integrations.",
      "Periodically validate AI additions with industry experts (IEs).",
    ],
  },
  {
    id: "GP 2",
    name: "Content Improvement Velocity",
    validFor: "Instructor Team",
    metricType: "Leading",
    section: "good-practice",
    points: [
      "Measure the speed and consistency of implementing validated content improvements.",
      "Track: Time taken from issue identification to implementation, Number of validated improvements shipped monthly, Repeat issue reduction percentage.",
      "The goal should be continuous incremental improvement across all programmes.",
    ],
  },
];

// ─── Styles ─────────────────────────────────────────────────
const METRIC_STYLE: Record<string, string> = {
  Leading:
    "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  Lagging:
    "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
};

// ─── Page ───────────────────────────────────────────────────
export default function KRsPage() {
  const krs = KRS.filter((k) => k.section !== "good-practice");
  const goodPractices = KRS.filter((k) => k.section === "good-practice");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">
          KR Framework — Instructor Team
        </h1>
        <p className="text-sm text-muted">
          Key Results and good practices for the current cycle.
        </p>
      </div>

      {/* ── KRs ── */}
      <div className="space-y-4">
        {krs.map((kr) => (
          <KRCard key={kr.id} kr={kr} />
        ))}
      </div>

      {/* ── Good Practices ── */}
      {goodPractices.length > 0 && (
        <>
          <div className="pt-2">
            <h2 className="text-base font-semibold tracking-tight text-fg">
              Good Practices
            </h2>
            <p className="text-sm text-muted">
              Recommended practices to maintain alongside KRs.
            </p>
          </div>
          <div className="space-y-4">
            {goodPractices.map((kr) => (
              <KRCard key={kr.id} kr={kr} />
            ))}
          </div>
        </>
      )}

      <p className="text-xs text-muted">
        This is a static page. To update, edit the KRS array in{" "}
        <code className="rounded bg-bg px-1 py-0.5 font-mono text-[11px]">
          app/(app)/krs/page.tsx
        </code>
        , commit, and push.
      </p>
    </div>
  );
}

function KRCard({ kr }: { kr: KR }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="rounded-lg bg-accent px-2.5 py-1 text-xs font-bold text-white">
            {kr.id}
          </span>
          <h3 className="text-base font-bold text-fg">{kr.name}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${METRIC_STYLE[kr.metricType] ?? ""}`}
          >
            {kr.metricType}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {kr.validFor}
          </span>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {kr.points.map((point, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-fg/85">
            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent/50" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
