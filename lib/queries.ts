import { createClient } from "@/lib/supabase/server";
import { getMyAccess } from "@/lib/access";
import { DEFAULT_METRICS, type AdhocRequest, type Profile, type Task } from "@/lib/types";
import { DEFAULT_KRS, type KR } from "@/lib/kr-defaults";

export type MembershipRow = { profile_id: string; program: string; role: "mo" | "user" };

// Non-admin program scoping. Shows items in the user's programs PLUS
// unclassified items (program IS NULL) — a task with no program isn't locked to
// any program, so it shouldn't disappear for non-admins. Admins are unfiltered.
function scopeByProgram<Q extends { in: any; or: any; is: any }>(
  query: Q,
  access: { isAdmin: boolean; visiblePrograms: string[] }
): Q {
  if (access.isAdmin) return query;
  const progs = access.visiblePrograms;
  if (progs.length === 0) return query.is("program", null);
  const list = progs.map((p) => `"${p}"`).join(",");
  return query.or(`program.in.(${list}),program.is.null`);
}

// All program memberships (for the management UI). Readable by any signed-in user.
export async function getAllMemberships(): Promise<MembershipRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("program_memberships")
    .select("profile_id, program, role");
  return (data as MembershipRow[]) ?? [];
}

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
  const access = await getMyAccess();

  let query = supabase
    .from("tasks")
    .select(
      `*,
       assignee:profiles!tasks_assignee_id_fkey (${PROFILE_COLS}),
       creator:profiles!tasks_created_by_fkey (${PROFILE_COLS}),
       task_stakeholders ( profile:profiles!task_stakeholders_profile_id_fkey (${PROFILE_COLS}) )`
    )
    .order("created_at", { ascending: false });

  // Program scoping: non-admins see their programs + unclassified (null) items.
  query = scopeByProgram(query, access);

  const { data, error } = await query;

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
    creator: row.creator ?? null,
    stakeholders: (row.task_stakeholders ?? [])
      .map((s: any) => s.profile)
      .filter(Boolean),
  })) as Task[];
}

export async function getAdhocRequests(): Promise<AdhocRequest[]> {
  const supabase = createClient();
  const access = await getMyAccess();

  let query = supabase
    .from("adhoc_requests")
    .select(
      `id, source, status, eta, delivered_date, metrics, assignee_id, slack_ts, permalink, title, posted_at, created_at, raised_by, program, batch, module, beneficiary, problem, learners_impact, risk_if_not_done, outcome, module_owner, stakeholder,
       assignee:profiles!adhoc_requests_assignee_id_fkey (${PROFILE_COLS})`
    )
    .order("created_at", { ascending: false });

  // Program scoping: non-admins see their programs + unclassified (null) items.
  query = scopeByProgram(query, access);

  const { data, error } = await query;

  if (error) {
    console.error("getAdhocRequests:", error.message);
    return [];
  }
  return (data ?? []).map((row: any) => ({
    ...row,
    metrics: row.metrics ?? [],
    assignee: row.assignee ?? null,
  })) as AdhocRequest[];
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

// KRs, shared for everyone. DB-backed (admins manage them). Falls back to the
// built-in defaults only if the table can't be read (e.g. before migration v15).
export async function getKRs(): Promise<KR[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("krs")
    .select("id, code, name, valid_for, metric_type, section, points, position, created_at")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return DEFAULT_KRS;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    validFor: r.valid_for,
    metricType: r.metric_type,
    section: r.section,
    points: r.points ?? [],
  }));
}

// The metric registry (single source of truth for pickers). Admins add/delete
// these; everyone else picks from them. Falls back to the built-in defaults if
// the table isn't there yet (pre-migration) so pickers never come up empty.
export async function getMetricNames(): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("metrics").select("name").order("name");
  if (error || !data) return [...DEFAULT_METRICS];
  return data.map((r: any) => r.name as string);
}
