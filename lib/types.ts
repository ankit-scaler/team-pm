export type Status = "To pick" | "Working" | "In Review" | "Completed";
export type Effort = "Low" | "Med" | "High";
export type Priority = "Low" | "Medium" | "High" | "Urgent";

export const STATUSES: Status[] = ["To pick", "Working", "In Review", "Completed"];
export const EFFORTS: Effort[] = ["Low", "Med", "High"];
export const PRIORITIES: Priority[] = ["Low", "Medium", "High", "Urgent"];

// Starter list shown in the Metrics dropdown even before anyone has used them.
// Anything typed beyond this list is just added to the suggestions automatically.
export const DEFAULT_METRICS = [
  "I2H",
  "NPS",
  "Class Ratings",
  "Cue Card Ratings",
  "Module Ratings",
  "PSP",
];

export const PROGRAMS = ["Academy", "DevOps", "AIML", "DSML"] as const;
export type Program = (typeof PROGRAMS)[number];

export const TRACKS = [
  "DSA",
  "Full Stack",
  "Backend",
  "Machine Learning",
  "Data Science",
  "Data Analytics",
  "DevOps",
  "FDE",
] as const;
export type Track = (typeof TRACKS)[number];

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "member" | "admin";
};

export type KR = {
  id: string;
  name: string;
  target: string;
  current: string;
  status: "On track" | "At risk" | "Behind" | "Achieved";
  sort_order: number;
};

export const KR_STATUSES = ["On track", "At risk", "Behind", "Achieved"] as const;

// Adhoc request — either fetched from #instructor-adhoc-request-1 (source
// "slack") or added manually in-app via "+ Adhoc" (source "manual").
export type AdhocRequest = {
  id: string;
  source: "slack" | "manual";
  status: Status;
  eta: string | null;
  delivered_date: string | null;
  slack_ts: string | null;
  permalink: string | null;
  title: string | null;
  posted_at: string | null;
  created_at: string;
  raised_by: string | null;
  program: string | null;
  batch: string | null;
  module: string | null;
  beneficiary: string | null;
  problem: string | null;
  learners_impact: string | null;
  risk_if_not_done: string | null;
  outcome: string | null;
  module_owner: string | null;
  stakeholder: string | null;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  eta: string | null;
  status: Status;
  effort: Effort | null;
  priority: Priority;
  assignee_id: string | null;
  created_by: string | null;
  picked_date: string | null;
  delivered_date: string | null;
  tags: string[];
  metrics: string[];
  slack_link: string | null;
  sheet_link: string | null;
  program: string | null;
  track: string | null;
  created_at: string;
  updated_at: string;
  assignee?: Profile | null;
  creator?: Profile | null;
  stakeholders?: Profile[];
};

// Tailwind class fragments per status (chips/borders). Kept centralized for consistency.
export const STATUS_STYLES: Record<Status, string> = {
  "To pick": "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  Working: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  "In Review": "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  Completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

export const PRIORITY_STYLES: Record<Priority, string> = {
  Low: "text-slate-500",
  Medium: "text-blue-600 dark:text-blue-400",
  High: "text-orange-600 dark:text-orange-400",
  Urgent: "text-red-600 dark:text-red-400",
};

export const EFFORT_STYLES: Record<Effort, string> = {
  Low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  Med: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  High: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

// Calm, light tints per stage. Each stage has its own hue family; a card gets a
// deterministic "random" shade from that family based on its id (stable across renders).
const STAGE_TINTS: Record<Status, string[]> = {
  "To pick": [
    "bg-slate-50 dark:bg-slate-900/40",
    "bg-zinc-50 dark:bg-zinc-900/40",
    "bg-gray-100 dark:bg-gray-900/40",
    "bg-stone-50 dark:bg-stone-900/40",
  ],
  Working: [
    "bg-blue-50 dark:bg-blue-950/30",
    "bg-sky-50 dark:bg-sky-950/30",
    "bg-indigo-50 dark:bg-indigo-950/30",
    "bg-cyan-50 dark:bg-cyan-950/30",
  ],
  "In Review": [
    "bg-amber-50 dark:bg-amber-950/30",
    "bg-yellow-50 dark:bg-yellow-950/30",
    "bg-orange-50 dark:bg-orange-950/30",
  ],
  Completed: [
    "bg-emerald-50 dark:bg-emerald-950/30",
    "bg-green-50 dark:bg-green-950/30",
    "bg-teal-50 dark:bg-teal-950/30",
    "bg-lime-50 dark:bg-lime-950/30",
  ],
};

// Left-edge accent per stage for extra visual separation.
export const STAGE_ACCENT: Record<Status, string> = {
  "To pick": "border-l-slate-300 dark:border-l-slate-600",
  Working: "border-l-blue-500",
  "In Review": "border-l-amber-500",
  Completed: "border-l-emerald-500",
};

export function cardTint(status: Status, id: string): string {
  const palette = STAGE_TINTS[status];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}
