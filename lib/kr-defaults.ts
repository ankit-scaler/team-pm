// Shared KR type + the original hard-coded KRs. These now live in the `krs`
// table (migration v15 seeds them). This array is kept only as a safe fallback
// for getKRs() if the table can't be read (e.g. before the migration is run),
// so the page never comes up empty. The DB is the source of truth once migrated.

export type KR = {
  id: string; // DB uuid; falls back to `code` for the defaults below
  code: string; // display code, e.g. "KR 1" / "GP 1"
  name: string;
  validFor: string;
  metricType: "Leading" | "Lagging";
  section: "kr" | "good-practice";
  points: string[];
};

export const DEFAULT_KRS: KR[] = [
  {
    id: "KR 1",
    code: "KR 1",
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
    code: "KR 1a",
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
    code: "KR 3",
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
    code: "KR 4",
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
    code: "KR 6",
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
    code: "KR 7",
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
    code: "GP 1",
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
    code: "GP 2",
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
