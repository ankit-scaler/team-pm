import { createClient } from "@/lib/supabase/server";
import { DEFAULT_METRICS, type Profile, type Task } from "@/lib/types";

const PROFILE_COLS = "id, email, full_name, avatar_url, role";

export async function getPeople(): Promise<Profile[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_COLS)
    .order("full_name", { ascending: true });
  return (data as Profile[]) ?? [];
}

export async function getTasks(): Promise<Task[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(
      `*,
       assignee:profiles!tasks_assignee_id_fkey (${PROFILE_COLS}),
       task_stakeholders ( profile:profiles!task_stakeholders_profile_id_fkey (${PROFILE_COLS}) )`
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getTasks:", error.message);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    ...row,
    tags: row.tags ?? [],
    metrics: row.metrics ?? [],
    program: row.program ?? null,
    track: row.track ?? null,
    assignee: row.assignee ?? null,
    stakeholders: (row.task_stakeholders ?? [])
      .map((s: any) => s.profile)
      .filter(Boolean),
  })) as Task[];
}

// Distinct tags already used across all tasks — powers tag autocomplete.
export function distinctTags(tasks: Task[]): string[] {
  return Array.from(new Set(tasks.flatMap((t) => t.tags ?? []))).sort((a, b) =>
    a.localeCompare(b)
  );
}

// Metric suggestions = the fixed starter list + anything custom anyone has used.
export function distinctMetrics(tasks: Task[]): string[] {
  const used = tasks.flatMap((t) => t.metrics ?? []);
  return Array.from(new Set([...DEFAULT_METRICS, ...used]));
}
