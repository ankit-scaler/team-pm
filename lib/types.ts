export type Status = "To pick" | "Working" | "In Review" | "Completed";
export type Effort = "Low" | "Med" | "High";
export type Priority = "Low" | "Medium" | "High" | "Urgent";

export const STATUSES: Status[] = ["To pick", "Working", "In Review", "Completed"];
export const EFFORTS: Effort[] = ["Low", "Med", "High"];
export const PRIORITIES: Priority[] = ["Low", "Medium", "High", "Urgent"];

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "member" | "admin";
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
  created_at: string;
  updated_at: string;
  assignee?: Profile | null;
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
