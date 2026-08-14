import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getMyAccess } from "@/lib/access";
import { DEFAULT_METRICS, PROGRAMS, TRACKS, EFFORTS, PRIORITIES, IMPACT_STATUS_DEFAULTS, type AdhocRequest, type ImpactRow, type Profile, type Task, type JoinTeam, type ManageTeam, type ManageTeamMember, type TeamMemberStatus } from "@/lib/types";
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
      `id, source, status, eta, eta_tbd, delivered_date, metrics, assignee_id, slack_ts, permalink, title, posted_at, created_at, raised_by, program, batch, module, beneficiary, problem, learners_impact, risk_if_not_done, outcome, module_owner, stakeholder,
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

// Admin activity log. Read via the service-role client (the table has no client
// RLS policy); the Activity page is admin-gated.
export type ActivityEntry = {
  id: string;
  actorId: string | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  entityLabel: string | null;
  summary: string;
  program: string | null;
  createdAt: string;
};

export async function getActivityLog(limit = 1000): Promise<ActivityEntry[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("activity_log")
    .select(
      "id, actor_id, actor_name, action, entity_type, entity_id, entity_label, summary, program, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r: any) => ({
    id: r.id,
    actorId: r.actor_id,
    actorName: r.actor_name,
    action: r.action,
    entityType: r.entity_type,
    entityId: r.entity_id,
    entityLabel: r.entity_label,
    summary: r.summary,
    program: r.program,
    createdAt: r.created_at,
  }));
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

// Programs & tracks registries — admins add these; everyone picks from them.
// Fall back to the built-in lists if the tables aren't there yet (pre-migration).
export async function getPrograms(): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("programs").select("name").order("name");
  if (error || !data) return [...PROGRAMS];
  return data.map((r: any) => r.name as string);
}
export async function getTracks(): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("tracks").select("name").order("name");
  if (error || !data) return [...TRACKS];
  return data.map((r: any) => r.name as string);
}
export async function getTags(): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("tags").select("name").order("name");
  if (error || !data) return [];
  return data.map((r: any) => r.name as string);
}
export async function getImpactStatuses(): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("impact_statuses").select("name").order("position");
  if (error || !data) return [...IMPACT_STATUS_DEFAULTS];
  return data.map((r: any) => r.name as string);
}

// Impact rows = every metric on every COMPLETED task, merged with any saved
// impact record. Read-scoped like tasks (non-admins: their programs + null).
export async function getImpactRows(): Promise<ImpactRow[]> {
  const supabase = createClient();
  const access = await getMyAccess();

  let tq = supabase
    .from("tasks")
    .select(
      `id, title, description, program, delivered_date, metrics, slack_link, sheet_link,
       assignee:profiles!tasks_assignee_id_fkey (${PROFILE_COLS}),
       task_stakeholders ( profile:profiles!task_stakeholders_profile_id_fkey (${PROFILE_COLS}) )`
    )
    .eq("status", "Completed")
    .order("delivered_date", { ascending: false });
  tq = scopeByProgram(tq, access);

  const [{ data: tasks }, { data: impacts }] = await Promise.all([
    tq,
    supabase.from("metric_impacts").select("*"),
  ]);

  const impactMap = new Map<string, any>();
  for (const r of impacts ?? []) impactMap.set(`${(r as any).task_id}::${(r as any).metric}`, r);

  const rows: ImpactRow[] = [];
  for (const t of (tasks ?? []) as any[]) {
    const stakeholders = (t.task_stakeholders ?? [])
      .map((s: any) => s.profile?.full_name ?? s.profile?.email)
      .filter(Boolean) as string[];
    for (const metric of (t.metrics ?? []) as string[]) {
      const r = impactMap.get(`${t.id}::${metric}`);
      rows.push({
        taskId: t.id,
        metric,
        assignee: t.assignee?.full_name ?? t.assignee?.email ?? null,
        assigneeId: t.assignee?.id ?? null,
        taskTitle: t.title,
        description: t.description,
        program: t.program ?? null,
        deliveredDate: t.delivered_date ?? null,
        slackLink: t.slack_link ?? null,
        sheetLink: t.sheet_link ?? null,
        stakeholders,
        metricType: r?.metric_type ?? null,
        preLabel: r?.pre_label ?? null,
        preValue: r?.pre_value ?? null,
        preDesc: r?.pre_desc ?? null,
        preUpdatedAt: r?.pre_updated_at ?? null,
        postLabel: r?.post_label ?? null,
        postValue: r?.post_value ?? null,
        postDesc: r?.post_desc ?? null,
        postUpdatedAt: r?.post_updated_at ?? null,
        status: r?.status ?? null,
      });
    }
  }
  return rows;
}

export async function getEfforts(): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("efforts").select("name").order("position");
  if (error || !data) return [...EFFORTS];
  return data.map((r: any) => r.name as string);
}
export async function getPriorities(): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("priorities").select("name").order("position");
  if (error || !data) return [...PRIORITIES];
  return data.map((r: any) => r.name as string);
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

// -------------------------------- Teams --------------------------------

// All teams for the join screen: leader name, accepted-member count, and the
// current user's status in each (null / pending / accepted).
export async function getTeamsForJoin(): Promise<JoinTeam[]> {
  const supabase = createClient();
  const access = await getMyAccess();
  const [{ data: teams }, { data: members }] = await Promise.all([
    supabase
      .from("teams")
      .select(`id, name, leader:profiles!teams_leader_id_fkey ( full_name, email )`)
      .order("name", { ascending: true }),
    supabase.from("team_members").select("team_id, profile_id, status"),
  ]);

  const acceptedCount = new Map<string, number>();
  const mine = new Map<string, TeamMemberStatus>();
  for (const m of (members ?? []) as any[]) {
    if (m.status === "accepted") acceptedCount.set(m.team_id, (acceptedCount.get(m.team_id) ?? 0) + 1);
    if (m.profile_id === access.userId) mine.set(m.team_id, m.status as TeamMemberStatus);
  }

  return (teams ?? []).map((t: any) => ({
    id: t.id,
    name: t.name,
    leaderName: t.leader?.full_name ?? t.leader?.email ?? null,
    memberCount: acceptedCount.get(t.id) ?? 0,
    myStatus: mine.get(t.id) ?? null,
  }));
}

// Teams with their members (accepted + pending) for the management page.
// Admins get every team; leaders get only the teams they lead.
export async function getTeamsManage(): Promise<ManageTeam[]> {
  const supabase = createClient();
  const access = await getMyAccess();
  const [{ data: teams }, { data: members }] = await Promise.all([
    supabase
      .from("teams")
      .select(`id, name, leader_id, leader:profiles!teams_leader_id_fkey ( full_name, email )`)
      .order("name", { ascending: true }),
    supabase
      .from("team_members")
      .select(`team_id, status, profile:profiles!team_members_profile_id_fkey ( id, full_name, email )`),
  ]);

  const byTeam = new Map<string, ManageTeamMember[]>();
  for (const m of (members ?? []) as any[]) {
    if (!m.profile) continue;
    const list = byTeam.get(m.team_id) ?? [];
    list.push({
      profileId: m.profile.id,
      name: m.profile.full_name ?? m.profile.email,
      email: m.profile.email,
      status: m.status as TeamMemberStatus,
    });
    byTeam.set(m.team_id, list);
  }

  let list = (teams ?? []).map((t: any) => ({
    id: t.id,
    name: t.name,
    leaderId: t.leader_id ?? null,
    leaderName: t.leader?.full_name ?? t.leader?.email ?? null,
    members: (byTeam.get(t.id) ?? []).sort((a, b) => {
      // Pending first (need action), then alphabetical.
      if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
      return a.name.localeCompare(b.name);
    }),
  }));

  if (!access.isAdmin) list = list.filter((t) => access.ledTeamIds.includes(t.id));
  return list;
}

// team id → accepted member profile ids, for the board/tasks team filter.
export async function getTeamsWithMembers(): Promise<{ id: string; name: string; memberIds: string[] }[]> {
  const supabase = createClient();
  const [{ data: teams }, { data: members }] = await Promise.all([
    supabase.from("teams").select("id, name").order("name", { ascending: true }),
    supabase.from("team_members").select("team_id, profile_id").eq("status", "accepted"),
  ]);
  const byTeam = new Map<string, string[]>();
  for (const m of (members ?? []) as any[]) {
    const list = byTeam.get(m.team_id) ?? [];
    list.push(m.profile_id);
    byTeam.set(m.team_id, list);
  }
  return (teams ?? []).map((t: any) => ({ id: t.id, name: t.name, memberIds: byTeam.get(t.id) ?? [] }));
}
