"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { notifyStatusChange } from "@/lib/slack";
import { syncTaskCalendarEvent, deleteTaskCalendarEvent } from "@/lib/google";
import { getMyAccess } from "@/lib/access";
import type { MembershipRole } from "@/lib/access";
import { type Status, type AiImpactSummary } from "@/lib/types";
import { getMetricNames, getTags } from "@/lib/queries";
import { geminiGenerate } from "@/lib/gemini";

// Only admins may create NEW metrics. For non-admins, drop any submitted metric
// that isn't already a known one (the default seed list or one already in use).
async function sanitizeMetrics(submitted: string[]): Promise<string[]> {
  if (submitted.length === 0) return submitted;
  const access = await getMyAccess();

  // Known metrics = the registry table.
  const known = await getMetricNames();
  const knownLower = new Set(known.map((m) => m.toLowerCase()));

  if (access.isAdmin) {
    // Admins may introduce new metrics — register any that aren't in the table
    // yet so they show up in every picker from now on.
    const fresh = submitted.filter((m) => m.trim() && !knownLower.has(m.trim().toLowerCase()));
    if (fresh.length) {
      const admin = createAdminClient();
      await admin
        .from("metrics")
        .upsert(fresh.map((name) => ({ name: name.trim() })), { onConflict: "name" });
      for (const name of fresh) {
        await logActivity({
          action: "created",
          entityType: "metric",
          entityLabel: name.trim(),
          summary: `Created metric "${name.trim()}"`,
        });
      }
    }
    return submitted;
  }

  // Non-admins may only use metrics that already exist in the registry.
  return submitted.filter((m) => knownLower.has(m.trim().toLowerCase()));
}

// Tags follow the same rule as metrics: non-admins pick from the registry;
// admins may introduce new ones (auto-registered).
async function sanitizeTags(submitted: string[]): Promise<string[]> {
  if (submitted.length === 0) return submitted;
  const access = await getMyAccess();
  const known = await getTags();
  const knownLower = new Set(known.map((t) => t.toLowerCase()));
  if (access.isAdmin) {
    const fresh = submitted.filter((t) => t.trim() && !knownLower.has(t.trim().toLowerCase()));
    if (fresh.length) {
      const admin = createAdminClient();
      await admin.from("tags").upsert(fresh.map((name) => ({ name: name.trim() })), { onConflict: "name" });
    }
    return submitted;
  }
  return submitted.filter((t) => knownLower.has(t.trim().toLowerCase()));
}

// Delete a metric globally (admin only): drops it from the registry and strips
// it off every task/adhoc that carries it. Runs via the security-definer RPC.
export async function deleteMetric(name: string) {
  await requireAdmin();
  const clean = name.trim();
  if (!clean) return;
  const admin = createAdminClient();
  const { error } = await admin.rpc("delete_metric", { p_metric: clean });
  if (error) throw new Error(error.message);
  await logActivity({
    action: "deleted",
    entityType: "metric",
    entityLabel: clean,
    summary: `Deleted metric "${clean}"`,
  });
  revalidatePath("/board");
  revalidatePath("/tasks");
  revalidatePath("/adhoc");
  revalidatePath("/summary");
  revalidatePath("/program-track");
}

// ----------------------------------------------------------------
//  KRs — admin-managed, visible to everyone. Guarded server-side.
// ----------------------------------------------------------------
export async function createKR(formData: FormData) {
  await requireAdmin();

  const code = str(formData.get("code"));
  const name = str(formData.get("name"));
  if (!code || !name) throw new Error("Code and name are required");

  const metricRaw = str(formData.get("metric_type"));
  const metric_type = metricRaw === "Lagging" ? "Lagging" : "Leading";
  const sectionRaw = str(formData.get("section"));
  const section = sectionRaw === "good-practice" ? "good-practice" : "kr";
  const valid_for = str(formData.get("valid_for")) ?? "Instructor Team";
  const points = String(formData.get("points") ?? "")
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);

  const admin = createAdminClient();
  // Append after the current last KR.
  const { data: last } = await admin
    .from("krs")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = ((last?.position as number) ?? 0) + 10;

  const { error } = await admin
    .from("krs")
    .insert({ code, name, valid_for, metric_type, section, points, position });
  if (error) throw new Error(error.message);

  await logActivity({
    action: "created",
    entityType: "kr",
    entityLabel: `${code} ${name}`,
    summary: `Created KR "${code} — ${name}"`,
  });
  revalidatePath("/krs");
}

export async function updateKR(id: string, formData: FormData) {
  await requireAdmin();
  if (!id) return;

  const code = str(formData.get("code"));
  const name = str(formData.get("name"));
  if (!code || !name) throw new Error("Code and name are required");

  const metricRaw = str(formData.get("metric_type"));
  const metric_type = metricRaw === "Lagging" ? "Lagging" : "Leading";
  const sectionRaw = str(formData.get("section"));
  const section = sectionRaw === "good-practice" ? "good-practice" : "kr";
  const valid_for = str(formData.get("valid_for")) ?? "Instructor Team";
  const points = String(formData.get("points") ?? "")
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);

  const admin = createAdminClient();
  // position is intentionally left as-is so the ordering doesn't jump on edit.
  const { error } = await admin
    .from("krs")
    .update({ code, name, valid_for, metric_type, section, points })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await logActivity({
    action: "updated",
    entityType: "kr",
    entityId: id,
    entityLabel: `${code} ${name}`,
    summary: `Edited KR "${code} — ${name}"`,
  });
  revalidatePath("/krs");
}

export async function deleteKR(id: string) {
  await requireAdmin();
  if (!id) return;
  const admin = createAdminClient();
  const { data: before } = await admin.from("krs").select("code, name").eq("id", id).single();
  const { error } = await admin.from("krs").delete().eq("id", id);
  if (error) throw new Error(error.message);
  const label = before ? `${before.code} ${before.name}` : "(unknown)";
  await logActivity({
    action: "deleted",
    entityType: "kr",
    entityId: id,
    entityLabel: label,
    summary: `Deleted KR "${label}"`,
  });
  revalidatePath("/krs");
}

// Admins add new programs / tracks (registries used by the pickers everywhere).
export async function createProgram(name: string) {
  await requireAdmin();
  const clean = (name ?? "").trim();
  if (!clean) throw new Error("Program name is required");
  const admin = createAdminClient();
  const { error } = await admin.from("programs").upsert({ name: clean }, { onConflict: "name" });
  if (error) throw new Error(error.message);
  await logActivity({ action: "created", entityType: "program", entityLabel: clean, summary: `Created program "${clean}"` });
  revalidatePath("/admin");
  revalidatePath("/board");
  revalidatePath("/tasks");
  revalidatePath("/adhoc");
}

export async function createTrack(name: string) {
  await requireAdmin();
  const clean = (name ?? "").trim();
  if (!clean) throw new Error("Track name is required");
  const admin = createAdminClient();
  const { error } = await admin.from("tracks").upsert({ name: clean }, { onConflict: "name" });
  if (error) throw new Error(error.message);
  await logActivity({ action: "created", entityType: "track", entityLabel: clean, summary: `Created track "${clean}"` });
  revalidatePath("/admin");
  revalidatePath("/board");
  revalidatePath("/tasks");
}

export async function createMetric(name: string) {
  await requireAdmin();
  const clean = (name ?? "").trim();
  if (!clean) throw new Error("Metric name is required");
  const admin = createAdminClient();
  const { error } = await admin.from("metrics").upsert({ name: clean }, { onConflict: "name" });
  if (error) throw new Error(error.message);
  await logActivity({ action: "created", entityType: "metric", entityLabel: clean, summary: `Created metric "${clean}"` });
  revalidatePath("/admin");
  revalidatePath("/board");
  revalidatePath("/tasks");
  revalidatePath("/adhoc");
}

export async function createTag(name: string) {
  await requireAdmin();
  const clean = (name ?? "").trim();
  if (!clean) throw new Error("Tag name is required");
  const admin = createAdminClient();
  const { error } = await admin.from("tags").upsert({ name: clean }, { onConflict: "name" });
  if (error) throw new Error(error.message);
  await logActivity({ action: "created", entityType: "tag", entityLabel: clean, summary: `Created tag "${clean}"` });
  revalidatePath("/admin");
  revalidatePath("/board");
  revalidatePath("/tasks");
}

async function createOrdered(table: "efforts" | "priorities", name: string, label: "effort" | "priority") {
  await requireAdmin();
  const clean = (name ?? "").trim();
  if (!clean) throw new Error(`${label} name is required`);
  const admin = createAdminClient();
  const { data: last } = await admin
    .from(table)
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = ((last?.position as number) ?? 0) + 10;
  const { error } = await admin.from(table).upsert({ name: clean, position }, { onConflict: "name" });
  if (error) throw new Error(error.message);
  await logActivity({ action: "created", entityType: label, entityLabel: clean, summary: `Created ${label} "${clean}"` });
  revalidatePath("/admin");
  revalidatePath("/board");
  revalidatePath("/tasks");
}

export async function createEffort(name: string) {
  await createOrdered("efforts", name, "effort");
}
export async function createPriority(name: string) {
  await createOrdered("priorities", name, "priority");
}

// Admin-managed impact-status options (for the Impact page).
export async function createImpactStatus(name: string) {
  await requireAdmin();
  const clean = (name ?? "").trim();
  if (!clean) throw new Error("Status name is required");
  const admin = createAdminClient();
  const { data: last } = await admin
    .from("impact_statuses")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = ((last?.position as number) ?? 0) + 10;
  const { error } = await admin.from("impact_statuses").upsert({ name: clean, position }, { onConflict: "name" });
  if (error) throw new Error(error.message);
  await logActivity({ action: "created", entityType: "impact", entityLabel: clean, summary: `Created impact status "${clean}"` });
  revalidatePath("/impact");
  revalidatePath("/lists");
  revalidatePath("/admin");
}

// Save a (task, metric) impact record. Editable by admins and MOs of the task's
// program. Stamps pre/post timestamps only when that side actually changed.
export async function upsertMetricImpact(input: {
  taskId: string;
  metric: string;
  metricType?: string | null;
  preLabel?: string | null;
  preValue?: string | null;
  preDesc?: string | null;
  postLabel?: string | null;
  postValue?: string | null;
  postDesc?: string | null;
  status?: string | null;
}): Promise<{ error?: string } | void> {
  const access = await getMyAccess();
  const supabase = createClient();
  const { data: task } = await supabase
    .from("tasks")
    .select("title, program")
    .eq("id", input.taskId)
    .single();
  if (!task) return { error: "Task not found" };

  const program = (task.program as string | null) ?? null;
  const canEdit = access.isAdmin || (!!program && access.moPrograms.includes(program));
  if (!canEdit) return { error: "Only an admin or a module owner of this program can edit impact." };

  const admin = createAdminClient();
  const { data: before } = await admin
    .from("metric_impacts")
    .select("*")
    .eq("task_id", input.taskId)
    .eq("metric", input.metric)
    .maybeSingle();

  const norm = (v?: string | null) => (v == null || v.trim() === "" ? null : v.trim());
  const pre = { pre_label: norm(input.preLabel), pre_value: norm(input.preValue), pre_desc: norm(input.preDesc) };
  const post = { post_label: norm(input.postLabel), post_value: norm(input.postValue), post_desc: norm(input.postDesc) };

  const b = (before ?? {}) as any;
  const preChanged =
    b.pre_label !== pre.pre_label || b.pre_value !== pre.pre_value || b.pre_desc !== pre.pre_desc;
  const postChanged =
    b.post_label !== post.post_label || b.post_value !== post.post_value || b.post_desc !== post.post_desc;
  const preHasContent = !!(pre.pre_label || pre.pre_value || pre.pre_desc);
  const postHasContent = !!(post.post_label || post.post_value || post.post_desc);
  const now = new Date().toISOString();

  const { error } = await admin.from("metric_impacts").upsert(
    {
      task_id: input.taskId,
      metric: input.metric,
      metric_type: norm(input.metricType),
      ...pre,
      ...post,
      status: norm(input.status),
      pre_updated_at: preChanged && preHasContent ? now : b.pre_updated_at ?? null,
      post_updated_at: postChanged && postHasContent ? now : b.post_updated_at ?? null,
      updated_at: now,
    },
    { onConflict: "task_id,metric" }
  );
  if (error) return { error: error.message };

  await logActivity({
    action: "updated",
    entityType: "impact",
    entityId: input.taskId,
    entityLabel: `${task.title} · ${input.metric}`,
    summary: `Updated impact for "${task.title}" (${input.metric})`,
    program,
  });

  revalidatePath("/impact");
}

// RBAC guard: a non-admin may only act within programs they belong to.
async function assertProgramAllowed(program: string | null) {
  const access = await getMyAccess();
  if (access.isAdmin) return;
  // Unclassified (no-program) items are visible to everyone, so they're
  // actionable by everyone too — matches the scoping in getTasks/getAdhoc.
  if (!program) return;
  if (!access.visiblePrograms.includes(program)) {
    throw new Error("You don't have access to that program.");
  }
}

// Only the assignee, a module owner of the program, or an admin may move a card.
async function assertCanMove(program: string | null, assigneeId: string | null) {
  const access = await getMyAccess();
  if (access.isAdmin) return;
  if (assigneeId && assigneeId === access.userId) return;
  if (program && access.moPrograms.includes(program)) return;
  throw new Error("Only the assignee, a module owner, or an admin can move this card.");
}

function appUrl(): string {
  const h = headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  return host ? `${proto}://${host}` : "";
}

async function currentProfile() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", user.id)
    .single();
  return {
    id: user.id,
    name: data?.full_name ?? data?.email ?? user.email ?? "Someone",
  };
}

function str(v: FormDataEntryValue | null): string | null {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
}

// Dedupe + clean a multi-value field submitted from the form (tags, metrics).
function parseMultiValue(formData: FormData, field: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of formData.getAll(field)) {
    const s = v.toString().trim();
    if (s && !seen.has(s.toLowerCase())) {
      seen.add(s.toLowerCase());
      out.push(s);
    }
  }
  return out;
}

// ── Activity log ──────────────────────────────────────────────
// Append a row to the audit log. Best-effort: logging must never break the
// underlying action, so failures are swallowed.
type LogEntry = {
  action: "created" | "updated" | "deleted" | "moved";
  entityType:
    | "task" | "adhoc" | "kr" | "metric" | "tag" | "effort" | "priority"
    | "membership" | "role" | "user" | "program" | "track" | "impact";
  entityId?: string | null;
  entityLabel?: string | null;
  summary: string;
  program?: string | null;
};
async function logActivity(entry: LogEntry, actor?: { id: string; name: string }) {
  try {
    const me = actor ?? (await currentProfile());
    const admin = createAdminClient();
    await admin.from("activity_log").insert({
      actor_id: me.id,
      actor_name: me.name,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      entity_label: entry.entityLabel ?? null,
      summary: entry.summary,
      program: entry.program ?? null,
    });
  } catch {
    /* best-effort */
  }
}

// ── Required-field validation ─────────────────────────────────
// Returns a user-facing message for any missing field, or null if all present.
// (Returned — not thrown — so the message survives Next's production error redaction.)
function requireFields(values: Record<string, unknown>, labels: Record<string, string>): string | null {
  const missing = Object.keys(labels).filter((k) => {
    const v = values[k];
    if (v == null) return true;
    if (typeof v === "string") return v.trim() === "";
    if (Array.isArray(v)) return v.length === 0;
    return false;
  });
  return missing.length > 0 ? `Please fill: ${missing.map((k) => labels[k]).join(", ")}` : null;
}

// Tasks: everything required except Tags, Stakeholders, Effort (and links, which
// are only forced at Delivered). Returns an error message or null.
function validateTaskForm(formData: FormData, metrics: string[]): string | null {
  const etaTbd = formData.get("eta_tbd") === "on";
  return requireFields(
    {
      title: str(formData.get("title")),
      assignee_id: str(formData.get("assignee_id")),
      program: str(formData.get("program")),
      track: str(formData.get("track")),
      priority: str(formData.get("priority")),
      // Satisfied by a concrete date OR an explicit "to be decided".
      eta: etaTbd ? "tbd" : str(formData.get("eta")),
      metrics,
    },
    {
      title: "Title",
      assignee_id: "Assignee",
      program: "Program",
      track: "Track",
      priority: "Priority",
      eta: "ETA",
      metrics: "Metrics",
    }
  );
}

// Adhoc: everything required except ETA (Slack link stays optional). Returns an error message or null.
function validateAdhocForm(formData: FormData, metrics: string[]): string | null {
  return requireFields(
    {
      program: str(formData.get("program")),
      batch: str(formData.get("batch")),
      module: str(formData.get("module")),
      problem: str(formData.get("problem")),
      beneficiary: str(formData.get("beneficiary")),
      learners_impact: str(formData.get("learners_impact")),
      risk_if_not_done: str(formData.get("risk_if_not_done")),
      outcome: str(formData.get("outcome")),
      assignee_id: str(formData.get("assignee_id")),
      stakeholder: str(formData.get("stakeholder")),
      metrics,
    },
    {
      program: "Program",
      batch: "Batch",
      module: "Module",
      problem: "Problem statement",
      beneficiary: "Who benefits",
      learners_impact: "Learners impacted",
      risk_if_not_done: "Risk if not done",
      outcome: "Success/metrics",
      assignee_id: "Reviewer",
      stakeholder: "Stakeholder",
      metrics: "Metrics",
    }
  );
}

// Look up the emails for a set of profile ids (used for calendar attendees).
async function emailsForProfiles(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const supabase = createClient();
  const { data } = await supabase.from("profiles").select("email").in("id", ids);
  return (data ?? []).map((r: any) => r.email).filter(Boolean);
}

// Fuzzy-match free-text names (adhoc stakeholder / module owner) to team
// members and return their emails. Only returns confident matches (>= half the
// name's tokens overlap), so a bad name resolves to no one rather than the wrong
// person.
async function emailsForNames(names: string[]): Promise<string[]> {
  const clean = names.map((n) => (n ?? "").trim()).filter(Boolean);
  if (clean.length === 0) return [];
  const supabase = createClient();
  const { data } = await supabase.from("profiles").select("full_name, email");
  const profiles = (data ?? []) as { full_name: string | null; email: string }[];
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  const out = new Set<string>();
  for (const name of clean) {
    const target = norm(name);
    const tt = target.split(" ").filter(Boolean);
    let best: { email: string; score: number } | null = null;
    for (const p of profiles) {
      const cand = norm(p.full_name ?? p.email.split("@")[0]);
      if (!cand) continue;
      const ct = new Set(cand.split(" ").filter(Boolean));
      let overlap = 0;
      for (const x of tt) if (ct.has(x)) overlap++;
      let score = overlap / Math.max(tt.length, 1);
      if (cand === target) score = 1;
      if (!best || score > best.score) best = { email: p.email, score };
    }
    if (best && best.score >= 0.5) out.add(best.email);
  }
  return Array.from(out);
}

// Display name for a profile id (used to keep adhoc.module_owner text in sync
// with the chosen assignee).
async function nameForProfile(id: string | null): Promise<string | null> {
  if (!id) return null;
  const supabase = createClient();
  const { data } = await supabase.from("profiles").select("full_name, email").eq("id", id).single();
  return data?.full_name ?? data?.email ?? null;
}

async function syncStakeholders(taskId: string, ids: string[]) {
  const supabase = createClient();
  await supabase.from("task_stakeholders").delete().eq("task_id", taskId);
  if (ids.length > 0) {
    await supabase
      .from("task_stakeholders")
      .insert(ids.map((profile_id) => ({ task_id: taskId, profile_id })));
  }
}

export async function createTask(formData: FormData) {
  const supabase = createClient();
  const me = await currentProfile();

  await assertProgramAllowed(str(formData.get("program")));

  const status = (str(formData.get("status")) ?? "To pick") as Status;
  const stakeholderIds = formData.getAll("stakeholders").map(String).filter(Boolean);
  const metrics = await sanitizeMetrics(parseMultiValue(formData, "metrics"));
  const tags = await sanitizeTags(parseMultiValue(formData, "tags"));
  const vErr = validateTaskForm(formData, metrics);
  if (vErr) return { error: vErr };
  const etaTbd = formData.get("eta_tbd") === "on";
  const eta = etaTbd ? null : str(formData.get("eta"));

  // ETA invariant: only "To pick" tasks may have no ETA. Any other status needs
  // a real date (not TBD / empty) — so it can't be bypassed at creation.
  if (status !== "To pick" && !eta) {
    return { error: "Set an ETA (a real date). Only 'To pick' tasks can have no ETA." };
  }
  // Creating a task straight into Completed needs at least one link (matches the move rule).
  if (status === "Completed" && !str(formData.get("slack_link")) && !str(formData.get("sheet_link"))) {
    return { error: "Add a Slack link or a Sheet link (at least one) to mark a task as Completed." };
  }

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      title: str(formData.get("title")) ?? "Untitled task",
      description: str(formData.get("description")),
      eta,
      eta_tbd: etaTbd,
      status,
      effort: str(formData.get("effort")),
      priority: str(formData.get("priority")) ?? "Medium",
      assignee_id: str(formData.get("assignee_id")),
      delivered_date: str(formData.get("delivered_date")),
      tags,
      metrics,
      slack_link: str(formData.get("slack_link")),
      sheet_link: str(formData.get("sheet_link")),
      program: str(formData.get("program")),
      track: str(formData.get("track")),
      created_by: me.id,
    })
    .select("id, title, status")
    .single();

  if (error || !task) throw new Error(error?.message ?? "Could not create task");

  await syncStakeholders(task.id, stakeholderIds);

  // Task 1: block the stakeholders' calendars from today until the ETA.
  if (eta) {
    const emails = await emailsForProfiles(stakeholderIds);
    const eventId = await syncTaskCalendarEvent({
      taskId: task.id,
      creatorId: me.id,
      title: task.title,
      eta,
      existingEventId: null,
      stakeholderEmails: emails,
    });
    if (eventId) {
      await supabase.from("tasks").update({ calendar_event_id: eventId }).eq("id", task.id);
    }
  }

  // Look up assignee name for the Slack message (if assigned to someone)
  const assigneeId = str(formData.get("assignee_id"));
  let assigneeName: string | null = null;
  if (assigneeId) {
    const { data: assignee } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", assigneeId)
      .single();
    assigneeName = assignee?.full_name ?? assignee?.email ?? null;
  }

  await notifyStatusChange({
    taskTitle: task.title,
    taskId: task.id,
    oldStatus: null,
    newStatus: task.status as Status,
    actorName: me.name,
    assigneeName,
    appUrl: appUrl(),
  });

  await logActivity(
    {
      action: "created",
      entityType: "task",
      entityId: task.id,
      entityLabel: task.title,
      summary: `Created task "${task.title}"`,
      program: str(formData.get("program")),
    },
    me
  );

  revalidatePath("/board");
  revalidatePath("/tasks");
  revalidatePath("/people");
}

export async function updateTask(taskId: string, formData: FormData) {
  const supabase = createClient();
  const me = await currentProfile();

  const { data: before } = await supabase
    .from("tasks")
    .select("status, title, eta, eta_tbd, assignee_id, created_by, calendar_event_id, program")
    .eq("id", taskId)
    .single();

  await assertProgramAllowed(before?.program ?? null);
  // Also block moving the task INTO a program the caller isn't in.
  await assertProgramAllowed(str(formData.get("program")));

  const newStatus = (str(formData.get("status")) ?? "To pick") as Status;
  const stakeholderIds = formData.getAll("stakeholders").map(String).filter(Boolean);
  const metrics = await sanitizeMetrics(parseMultiValue(formData, "metrics"));
  const tags = await sanitizeTags(parseMultiValue(formData, "tags"));
  const vErr = validateTaskForm(formData, metrics);
  if (vErr) return { error: vErr };

  const etaTbd = formData.get("eta_tbd") === "on";
  const newEta = etaTbd ? null : str(formData.get("eta"));

  // Changing status in the form is a "move" too — same permission as the board.
  if (before && before.status !== newStatus) {
    await assertCanMove(before.program ?? null, before.assignee_id ?? null);
  }

  // ETA invariant: any status other than "To pick" must have a real ETA (not
  // TBD / empty). Enforced on every save so it can't be bypassed via the form.
  if (newStatus !== "To pick" && !newEta) {
    return { error: "Set an ETA (a real date). Only 'To pick' tasks can have no ETA." };
  }
  // Delivering (Completed) needs both links — only when transitioning in, so
  // editing an already-Completed task's date isn't blocked.
  if (
    before &&
    before.status !== "Completed" &&
    newStatus === "Completed" &&
    !str(formData.get("slack_link")) &&
    !str(formData.get("sheet_link"))
  ) {
    return { error: "Add a Slack link or a Sheet link (at least one) before marking a task Delivered." };
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      title: str(formData.get("title")) ?? "Untitled task",
      description: str(formData.get("description")),
      eta: newEta,
      eta_tbd: etaTbd,
      status: newStatus,
      effort: str(formData.get("effort")),
      priority: str(formData.get("priority")) ?? "Medium",
      assignee_id: str(formData.get("assignee_id")),
      delivered_date: str(formData.get("delivered_date")),
      tags,
      metrics,
      slack_link: str(formData.get("slack_link")),
      sheet_link: str(formData.get("sheet_link")),
      program: str(formData.get("program")),
      track: str(formData.get("track")),
    })
    .eq("id", taskId);

  if (error) throw new Error(error.message);

  await syncStakeholders(taskId, stakeholderIds);

  // Task 1: keep the calendar block in sync with the ETA / completion.
  const newTitle = str(formData.get("title")) ?? before?.title ?? "Untitled task";
  if (newStatus === "Completed") {
    if (before?.calendar_event_id) {
      await deleteTaskCalendarEvent(before.created_by ?? null, before.calendar_event_id);
      await supabase.from("tasks").update({ calendar_event_id: null }).eq("id", taskId);
    }
  } else {
    const emails = await emailsForProfiles(stakeholderIds);
    const eventId = await syncTaskCalendarEvent({
      taskId,
      creatorId: before?.created_by ?? me.id,
      title: newTitle,
      eta: newEta,
      existingEventId: before?.calendar_event_id ?? null,
      stakeholderEmails: emails,
    });
    if ((eventId ?? null) !== (before?.calendar_event_id ?? null)) {
      await supabase.from("tasks").update({ calendar_event_id: eventId }).eq("id", taskId);
    }
  }

  if (before && before.status !== newStatus) {
    await notifyStatusChange({
      taskTitle: str(formData.get("title")) ?? before.title,
      taskId,
      oldStatus: before.status as Status,
      newStatus,
      actorName: me.name,
      appUrl: appUrl(),
    });
  }

  const statusNote = before && before.status !== newStatus ? ` (status → ${newStatus})` : "";
  const etaBefore = before?.eta_tbd ? "TBD" : before?.eta ?? null;
  const etaAfter = etaTbd ? "TBD" : newEta;
  const etaNote = before && etaBefore !== etaAfter ? ` (ETA → ${etaAfter ?? "none"})` : "";
  await logActivity(
    {
      action: "updated",
      entityType: "task",
      entityId: taskId,
      entityLabel: newTitle,
      summary: `Edited task "${newTitle}"${statusNote}${etaNote}`,
      program: str(formData.get("program")),
    },
    me
  );

  revalidatePath("/board");
  revalidatePath("/tasks");
  revalidatePath("/people");
}

// Quick status change (used by the Kanban board). Also claims the task on "Working".
export async function changeStatus(taskId: string, newStatus: Status) {
  const supabase = createClient();
  const me = await currentProfile();

  const { data: before } = await supabase
    .from("tasks")
    .select("status, title, eta, assignee_id, created_by, calendar_event_id, program, slack_link, sheet_link")
    .eq("id", taskId)
    .single();

  if (!before) throw new Error("Task not found");
  await assertProgramAllowed(before.program ?? null);
  await assertCanMove(before.program ?? null, before.assignee_id ?? null);

  // Starting work requires a concrete ETA date (a "to be decided" ETA isn't enough).
  if (newStatus === "Working" && !before.eta) {
    throw new Error("Set an ETA (a real date) before moving this task to Working.");
  }

  // Delivering requires at least one link; the board routes this through deliverTask,
  // but guard here too so it can't be completed link-less by any path.
  if (newStatus === "Completed" && !before.slack_link && !before.sheet_link) {
    throw new Error("Add a Slack link or a Sheet link before delivering.");
  }

  const update: { status: Status; assignee_id?: string } = { status: newStatus };
  // When someone starts working and nobody owns it yet, they pick it up.
  if (newStatus === "Working" && !before.assignee_id) update.assignee_id = me.id;

  const { error } = await supabase.from("tasks").update(update).eq("id", taskId);
  if (error) throw new Error(error.message);

  // Completing a task (via the board) releases its calendar block too.
  if (newStatus === "Completed" && before.calendar_event_id) {
    await deleteTaskCalendarEvent(before.created_by ?? null, before.calendar_event_id);
    await supabase.from("tasks").update({ calendar_event_id: null }).eq("id", taskId);
  }

  if (before.status !== newStatus) {
    await notifyStatusChange({
      taskTitle: before.title,
      taskId,
      oldStatus: before.status as Status,
      newStatus,
      actorName: me.name,
      appUrl: appUrl(),
    });
    await logActivity(
      {
        action: "moved",
        entityType: "task",
        entityId: taskId,
        entityLabel: before.title,
        summary: `Moved task "${before.title}" from ${before.status} to ${newStatus}`,
        program: before.program,
      },
      me
    );
  }

  revalidatePath("/board");
  revalidatePath("/tasks");
  revalidatePath("/people");
}

// Deliver a task (move to Completed) — requires at least one of a Slack link or
// a Sheet link, collected by a popup on the board. Sets the links + status together.
export async function deliverTask(taskId: string, slackLink: string, sheetLink: string) {
  const supabase = createClient();
  const me = await currentProfile();

  const slack = (slackLink ?? "").trim();
  const sheet = (sheetLink ?? "").trim();
  if (!slack && !sheet) throw new Error("Add a Slack link or a Sheet link (at least one) to deliver.");

  const { data: before } = await supabase
    .from("tasks")
    .select("status, title, assignee_id, created_by, calendar_event_id, program")
    .eq("id", taskId)
    .single();
  if (!before) throw new Error("Task not found");
  await assertProgramAllowed(before.program ?? null);
  await assertCanMove(before.program ?? null, before.assignee_id ?? null);

  const { error } = await supabase
    .from("tasks")
    .update({ status: "Completed", slack_link: slack || null, sheet_link: sheet || null })
    .eq("id", taskId);
  if (error) throw new Error(error.message);

  if (before.calendar_event_id) {
    await deleteTaskCalendarEvent(before.created_by ?? null, before.calendar_event_id);
    await supabase.from("tasks").update({ calendar_event_id: null }).eq("id", taskId);
  }

  if (before.status !== "Completed") {
    await notifyStatusChange({
      taskTitle: before.title,
      taskId,
      oldStatus: before.status as Status,
      newStatus: "Completed",
      actorName: me.name,
      appUrl: appUrl(),
    });
  }

  await logActivity(
    {
      action: "moved",
      entityType: "task",
      entityId: taskId,
      entityLabel: before.title,
      summary: `Delivered task "${before.title}"`,
      program: before.program,
    },
    me
  );

  revalidatePath("/board");
  revalidatePath("/tasks");
  revalidatePath("/people");
}

// Start a task (move to Working) — requires a concrete ETA date, collected by a
// popup on the board when the task has none / is "to be decided".
export async function startWorking(taskId: string, eta: string) {
  const supabase = createClient();
  const me = await currentProfile();

  const clean = (eta ?? "").trim();
  if (!clean) throw new Error("An ETA date is required to start working on a task.");

  const { data: before } = await supabase
    .from("tasks")
    .select("status, title, assignee_id, program")
    .eq("id", taskId)
    .single();
  if (!before) throw new Error("Task not found");
  await assertProgramAllowed(before.program ?? null);
  await assertCanMove(before.program ?? null, before.assignee_id ?? null);

  const update: { status: Status; eta: string; eta_tbd: boolean; assignee_id?: string } = {
    status: "Working",
    eta: clean,
    eta_tbd: false,
  };
  // Claim it if nobody owns it yet.
  if (!before.assignee_id) update.assignee_id = me.id;

  const { error } = await supabase.from("tasks").update(update).eq("id", taskId);
  if (error) throw new Error(error.message);

  if (before.status !== "Working") {
    await notifyStatusChange({
      taskTitle: before.title,
      taskId,
      oldStatus: before.status as Status,
      newStatus: "Working",
      actorName: me.name,
      appUrl: appUrl(),
    });
    await logActivity(
      {
        action: "moved",
        entityType: "task",
        entityId: taskId,
        entityLabel: before.title,
        summary: `Moved task "${before.title}" from ${before.status} to Working (ETA ${clean})`,
        program: before.program,
      },
      me
    );
  }

  revalidatePath("/board");
  revalidatePath("/tasks");
  revalidatePath("/people");
}

export async function deleteTask(taskId: string) {
  const supabase = createClient();
  const me = await currentProfile();
  const { data: before } = await supabase
    .from("tasks")
    .select("title, created_by, calendar_event_id, program")
    .eq("id", taskId)
    .single();

  await assertProgramAllowed(before?.program ?? null);

  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw new Error(error.message);

  // Task 1: remove any calendar block for this task (best-effort — a Google
  // hiccup must not fail the delete the user already confirmed).
  if (before?.calendar_event_id) {
    try {
      await deleteTaskCalendarEvent(before.created_by ?? null, before.calendar_event_id);
    } catch (e) {
      console.error("Calendar cleanup on task delete failed:", e);
    }
  }

  await logActivity(
    {
      action: "deleted",
      entityType: "task",
      entityId: taskId,
      entityLabel: before?.title ?? null,
      summary: `Deleted task "${before?.title ?? "(unknown)"}"`,
      program: before?.program ?? null,
    },
    me
  );

  revalidatePath("/board");
  revalidatePath("/tasks");
  revalidatePath("/people");
}

// Create a manual adhoc request from the "+ Adhoc" form. Slack-sourced adhoc
// requests are written separately by the /api/slack/events endpoint.
export async function createAdhocRequest(formData: FormData) {
  const supabase = createClient();
  const me = await currentProfile();

  await assertProgramAllowed(str(formData.get("program")));

  const etaTbd = formData.get("eta_tbd") === "on";
  const eta = etaTbd ? null : str(formData.get("eta"));
  const assigneeId = str(formData.get("assignee_id"));
  const moduleOwner = await nameForProfile(assigneeId); // keep text in sync with assignee
  const stakeholder = str(formData.get("stakeholder"));
  const metrics = await sanitizeMetrics(parseMultiValue(formData, "metrics"));
  const vErr = validateAdhocForm(formData, metrics);
  if (vErr) return { error: vErr };

  const { data: created, error } = await supabase
    .from("adhoc_requests")
    .insert({
      source: "manual",
      status: (str(formData.get("status")) ?? "To pick") as Status,
      eta,
      eta_tbd: etaTbd,
      metrics,
      assignee_id: assigneeId,
      permalink: str(formData.get("slack_link")),
      title: str(formData.get("title")),
      raised_by: str(formData.get("raised_by")) ?? me.name,
      program: str(formData.get("program")),
      batch: str(formData.get("batch")),
      module: str(formData.get("module")),
      beneficiary: str(formData.get("beneficiary")),
      problem: str(formData.get("problem")),
      learners_impact: str(formData.get("learners_impact")),
      risk_if_not_done: str(formData.get("risk_if_not_done")),
      outcome: str(formData.get("outcome")),
      module_owner: moduleOwner,
      stakeholder,
      created_by: me.id,
    })
    .select("id, title")
    .single();

  if (error || !created) throw new Error(error?.message ?? "Could not add request");

  // Calendar block for the creator (today -> ETA), inviting any named people we
  // can confidently match to team accounts.
  if (eta) {
    const emails = await emailsForNames([moduleOwner, stakeholder].filter(Boolean) as string[]);
    const eventId = await syncTaskCalendarEvent({
      taskId: created.id,
      creatorId: me.id,
      title: created.title ?? "Adhoc request",
      eta,
      existingEventId: null,
      stakeholderEmails: emails,
    });
    if (eventId) {
      await supabase.from("adhoc_requests").update({ calendar_event_id: eventId }).eq("id", created.id);
    }
  }

  await logActivity(
    {
      action: "created",
      entityType: "adhoc",
      entityId: created.id,
      entityLabel: created.title ?? str(formData.get("module")),
      summary: `Created adhoc "${created.title ?? str(formData.get("module")) ?? "request"}"`,
      program: str(formData.get("program")),
    },
    me
  );

  revalidatePath("/adhoc");
  revalidatePath("/board");
}

// Edit an adhoc request (e.g. add the ETA/status to a Slack-fetched one).
export async function updateAdhocRequest(id: string, formData: FormData) {
  const supabase = createClient();
  const me = await currentProfile();

  const { data: before } = await supabase
    .from("adhoc_requests")
    .select("status, assignee_id, created_by, calendar_event_id, program")
    .eq("id", id)
    .single();

  await assertProgramAllowed(before?.program ?? null);
  // Also block relabelling the request INTO a program the caller isn't in.
  await assertProgramAllowed(str(formData.get("program")));

  const status = (str(formData.get("status")) ?? "To pick") as Status;
  // Changing status in the form is a "move" too — same permission as the board.
  if (before && before.status !== status) {
    await assertCanMove(before.program ?? null, before.assignee_id ?? null);
  }
  const etaTbd = formData.get("eta_tbd") === "on";
  const eta = etaTbd ? null : str(formData.get("eta"));
  const title = str(formData.get("title"));
  const assigneeId = str(formData.get("assignee_id"));
  const moduleOwner = await nameForProfile(assigneeId);
  const stakeholder = str(formData.get("stakeholder"));
  const metrics = await sanitizeMetrics(parseMultiValue(formData, "metrics"));
  const vErr = validateAdhocForm(formData, metrics);
  if (vErr) return { error: vErr };

  const { error } = await supabase
    .from("adhoc_requests")
    .update({
      status,
      eta,
      eta_tbd: etaTbd,
      title,
      metrics,
      assignee_id: assigneeId,
      permalink: str(formData.get("slack_link")),
      program: str(formData.get("program")),
      batch: str(formData.get("batch")),
      module: str(formData.get("module")),
      beneficiary: str(formData.get("beneficiary")),
      problem: str(formData.get("problem")),
      learners_impact: str(formData.get("learners_impact")),
      risk_if_not_done: str(formData.get("risk_if_not_done")),
      outcome: str(formData.get("outcome")),
      module_owner: moduleOwner,
      stakeholder,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  // Keep the calendar block in sync (only possible if the row has a creator with
  // a connected calendar — Slack-fetched rows have no creator, so this no-ops).
  if (status === "Completed") {
    if (before?.calendar_event_id) {
      await deleteTaskCalendarEvent(before.created_by ?? null, before.calendar_event_id);
      await supabase.from("adhoc_requests").update({ calendar_event_id: null }).eq("id", id);
    }
  } else {
    const emails = await emailsForNames([moduleOwner, stakeholder].filter(Boolean) as string[]);
    const eventId = await syncTaskCalendarEvent({
      taskId: id,
      creatorId: before?.created_by ?? null,
      title: title ?? "Adhoc request",
      eta,
      existingEventId: before?.calendar_event_id ?? null,
      stakeholderEmails: emails,
    });
    if ((eventId ?? null) !== (before?.calendar_event_id ?? null)) {
      await supabase.from("adhoc_requests").update({ calendar_event_id: eventId }).eq("id", id);
    }
  }

  await logActivity(
    {
      action: "updated",
      entityType: "adhoc",
      entityId: id,
      entityLabel: title ?? str(formData.get("module")),
      summary: `Edited adhoc "${title ?? str(formData.get("module")) ?? "request"}"`,
      program: str(formData.get("program")),
    },
    me
  );

  revalidatePath("/adhoc");
  revalidatePath("/board");
}

// Move an adhoc request across stages from the Board.
export async function changeAdhocStatus(id: string, newStatus: Status) {
  const supabase = createClient();
  const me = await currentProfile(); // ensure signed in

  const { data: before } = await supabase
    .from("adhoc_requests")
    .select("status, title, module, assignee_id, created_by, calendar_event_id, program")
    .eq("id", id)
    .single();

  await assertProgramAllowed(before?.program ?? null);
  await assertCanMove(before?.program ?? null, before?.assignee_id ?? null);

  const { error } = await supabase
    .from("adhoc_requests")
    .update({ status: newStatus })
    .eq("id", id);
  if (error) throw new Error(error.message);

  // Completing it releases the calendar block.
  if (newStatus === "Completed" && before?.calendar_event_id) {
    await deleteTaskCalendarEvent(before.created_by ?? null, before.calendar_event_id);
    await supabase.from("adhoc_requests").update({ calendar_event_id: null }).eq("id", id);
  }

  if (before && before.status !== newStatus) {
    const label = before.title ?? before.module ?? "request";
    await logActivity(
      {
        action: "moved",
        entityType: "adhoc",
        entityId: id,
        entityLabel: label,
        summary: `Moved adhoc "${label}" from ${before.status} to ${newStatus}`,
        program: before.program,
      },
      me
    );
  }

  revalidatePath("/board");
  revalidatePath("/adhoc");
}

// Delete an adhoc request (and release any calendar block it created).
export async function deleteAdhocRequest(id: string) {
  const supabase = createClient();
  const me = await currentProfile();
  const { data: before } = await supabase
    .from("adhoc_requests")
    .select("title, module, created_by, calendar_event_id, program")
    .eq("id", id)
    .single();

  await assertProgramAllowed(before?.program ?? null);

  const { error } = await supabase.from("adhoc_requests").delete().eq("id", id);
  if (error) throw new Error(error.message);

  if (before?.calendar_event_id) {
    try {
      await deleteTaskCalendarEvent(before.created_by ?? null, before.calendar_event_id);
    } catch (e) {
      console.error("Calendar cleanup on adhoc delete failed:", e);
    }
  }

  const label = before?.title ?? before?.module ?? "(unknown)";
  await logActivity(
    {
      action: "deleted",
      entityType: "adhoc",
      entityId: id,
      entityLabel: label,
      summary: `Deleted adhoc "${label}"`,
      program: before?.program ?? null,
    },
    me
  );

  revalidatePath("/adhoc");
  revalidatePath("/board");
}

// ----------------------------------------------------------------
//  Admin actions — user management. Guarded server-side: the caller
//  must be an admin, regardless of what the UI shows.
// ----------------------------------------------------------------
async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (data?.role !== "admin") throw new Error("Admins only");
  return user.id;
}

// Assign / update a program membership. Admins can set any role for any program;
// MOs can only add Users to programs they own.
export async function setMembership(profileId: string, program: string, role: MembershipRole) {
  const access = await getMyAccess();
  const canManage = access.isAdmin || (role === "user" && access.moPrograms.includes(program));
  if (!canManage) throw new Error("Not allowed");

  const admin = createAdminClient();
  const { error } = await admin
    .from("program_memberships")
    .upsert({ profile_id: profileId, program, role }, { onConflict: "profile_id,program" });
  if (error) throw new Error(error.message);

  const who = (await nameForProfile(profileId)) ?? "someone";
  await logActivity({
    action: "updated",
    entityType: "membership",
    entityId: profileId,
    entityLabel: who,
    summary: `Set ${who} as ${role.toUpperCase()} of ${program}`,
    program,
  });

  revalidatePath("/admin");
  revalidatePath("/board");
  revalidatePath("/tasks");
  revalidatePath("/adhoc");
}

// Remove a program membership. Admins can remove any; MOs only 'user' rows in their programs.
// Grant access to several programs at once (same role for all). Mirrors
// setMembership's permission rule per program: admins can set any role; MOs may
// only add Users to programs they own.
export async function setMemberships(
  profileId: string,
  programs: string[],
  role: MembershipRole
) {
  const access = await getMyAccess();
  const clean = Array.from(
    new Set((programs ?? []).map((p) => (p ?? "").trim()).filter(Boolean))
  );
  if (clean.length === 0) return;

  for (const program of clean) {
    const canManage = access.isAdmin || (role === "user" && access.moPrograms.includes(program));
    if (!canManage) throw new Error(`Not allowed to manage “${program}”.`);
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("program_memberships")
    .upsert(
      clean.map((program) => ({ profile_id: profileId, program, role })),
      { onConflict: "profile_id,program" }
    );
  if (error) throw new Error(error.message);

  const who = (await nameForProfile(profileId)) ?? "someone";
  await logActivity({
    action: "updated",
    entityType: "membership",
    entityId: profileId,
    entityLabel: who,
    summary: `Set ${who} as ${role.toUpperCase()} of ${clean.join(", ")}`,
    program: clean[0] ?? null,
  });

  revalidatePath("/admin");
  revalidatePath("/board");
  revalidatePath("/tasks");
  revalidatePath("/adhoc");
}

export async function removeMembership(profileId: string, program: string) {
  const access = await getMyAccess();
  const admin = createAdminClient();

  if (!access.isAdmin) {
    if (!access.moPrograms.includes(program)) throw new Error("Not allowed");
    const { data } = await admin
      .from("program_memberships")
      .select("role")
      .eq("profile_id", profileId)
      .eq("program", program)
      .single();
    if (data?.role !== "user") throw new Error("Not allowed");
  }

  const { error } = await admin
    .from("program_memberships")
    .delete()
    .eq("profile_id", profileId)
    .eq("program", program);
  if (error) throw new Error(error.message);

  const who = (await nameForProfile(profileId)) ?? "someone";
  await logActivity({
    action: "deleted",
    entityType: "membership",
    entityId: profileId,
    entityLabel: who,
    summary: `Removed ${who} from ${program}`,
    program,
  });

  revalidatePath("/admin");
  revalidatePath("/board");
}

export async function deleteUser(userId: string) {
  const adminId = await requireAdmin();
  if (userId === adminId) throw new Error("You can't delete your own account here.");

  const who = (await nameForProfile(userId)) ?? "user";

  // Removing the auth user cascades to their profile; their tasks stay but
  // become unassigned (assignee/created_by are set to null by the DB).
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);

  await logActivity({
    action: "deleted",
    entityType: "user",
    entityId: userId,
    entityLabel: who,
    summary: `Removed user ${who}`,
  });

  revalidatePath("/admin");
  revalidatePath("/people");
  revalidatePath("/board");
  revalidatePath("/tasks");
}

export async function setUserRole(userId: string, role: "member" | "admin") {
  const adminId = await requireAdmin();
  if (userId === adminId && role !== "admin") {
    throw new Error("You can't remove your own admin access.");
  }
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ role }).eq("id", userId);
  if (error) throw new Error(error.message);

  const who = (await nameForProfile(userId)) ?? "user";
  await logActivity({
    action: "updated",
    entityType: "role",
    entityId: userId,
    entityLabel: who,
    summary: role === "admin" ? `Made ${who} an admin` : `Revoked admin from ${who}`,
  });
  revalidatePath("/admin");
}

// AI summary of the (already filtered) Impact table. The client sends a compact
// snapshot of the visible rows; we build a prompt and call Gemini. Returns
// { summary } or { error } (never throws, so production doesn't mask the message).
export async function aiSummarizeImpact(input: {
  filters: string[];
  rows: {
    task: string;
    assignee: string | null;
    program: string | null;
    stakeholders: string[];
    metric: string;
    metricType: string | null;
    pre: string;
    post: string;
    status: string;
    note: string;
  }[];
}): Promise<{ summary?: AiImpactSummary; error?: string }> {
  try {
    await getMyAccess(); // ensure an authenticated session
  } catch {
    return { error: "You need to be signed in." };
  }

  if (!input.rows || input.rows.length === 0) {
    return { error: "Nothing to summarize with the current filters." };
  }

  const scope =
    input.filters.length > 0 ? `Filters applied: ${input.filters.join(", ")}.` : "Scope: all completed tasks with metrics.";

  const data = input.rows
    .map((r) => {
      const parts = [
        `- Task "${r.task}" (owner: ${r.assignee ?? "unassigned"})`,
        `program: ${r.program ?? "unclassified"}`,
        `stakeholders: ${r.stakeholders.length ? r.stakeholders.join(", ") : "none"}`,
        `metric: ${r.metric}${r.metricType ? ` [${r.metricType}]` : ""}`,
        `before: ${r.pre || "—"}`,
        `after: ${r.post || "—"}`,
        `status: ${r.status}`,
      ];
      if (r.note) parts.push(`note: ${r.note}`);
      return parts.join(" | ");
    })
    .join("\n");

  const prompt = `You are an analyst summarizing an education team's "metric impact" tracker. Each line below is one metric measured on a completed task, with its before value, after value, and an impact status (Improved / Regression / Stable / To be updated). A value of "—" or an empty value means it has not been recorded yet.

${scope}

Produce a structured summary for a team lead, ORGANIZED BY PROGRAM:
- overview: 1-2 sentences across all programs — how many metrics have real before→after data and the general direction. If almost nothing is recorded yet, say so plainly.
- programs: one entry for EACH distinct program in the data. For each program:
  - program: the program name exactly as given (use "Unclassified" for items with no program).
  - summary: 1-2 sentences summarizing that program's impact — what moved and the overall direction for this program specifically.
  - highlights: the notable improvements/changes in this program that actually have values. "title" = metric and task (e.g. "Class Ratings — DSA Scripts"), "detail" = the before → after change and status, naming the owner and the stakeholder(s) it matters to.
  - watch: regressions in this program (list each individually) plus AT MOST 3 of the most notable metrics still pending an after-value. Same title/detail shape; name the owner and explain what needs attention.

Rules:
- Cover every program present in the data — do not merge or skip any.
- Do NOT list every pending metric one by one. Instead, state the pending count (e.g. "12 of 15 metrics still need an after-value") inside that program's "summary" sentence, and only surface a few notable pending ones in "watch".
- Be specific and use the real numbers/values and real people/stakeholder names; do NOT invent any.
- Refer to people and stakeholders by their names as given in the data.
- If a program's highlights or watch has nothing to report, return an empty array for it.
- Keep each detail to one or two tight sentences. No markdown symbols (#, *, backticks).

Data (${input.rows.length} metric rows):
${data}`;

  const item = {
    type: "OBJECT",
    properties: { title: { type: "STRING" }, detail: { type: "STRING" } },
    required: ["title", "detail"],
  };
  const schema = {
    type: "OBJECT",
    properties: {
      overview: { type: "STRING" },
      programs: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            program: { type: "STRING" },
            summary: { type: "STRING" },
            highlights: { type: "ARRAY", items: item },
            watch: { type: "ARRAY", items: item },
          },
          required: ["program", "summary", "highlights", "watch"],
        },
      },
    },
    required: ["overview", "programs"],
  };

  const res = await geminiGenerate(prompt, { schema });
  if (res.error) return { error: res.error };

  // Be forgiving: strip any ```json fences and slice to the outermost { ... }.
  const raw = (res.text ?? "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let jsonStr = (fenced ? fenced[1] : raw).trim();
  const first = jsonStr.indexOf("{");
  const last = jsonStr.lastIndexOf("}");
  if (first !== -1 && last > first) jsonStr = jsonStr.slice(first, last + 1);

  try {
    const parsed = JSON.parse(jsonStr) as AiImpactSummary;
    const cleanItems = (arr: any) =>
      Array.isArray(arr)
        ? arr
            .filter((x) => x && (x.title || x.detail))
            .map((x) => ({ title: String(x.title ?? ""), detail: String(x.detail ?? "") }))
        : [];
    const programs = Array.isArray(parsed.programs)
      ? parsed.programs.map((p: any) => ({
          program: String(p?.program ?? "Unclassified"),
          summary: typeof p?.summary === "string" ? p.summary : "",
          highlights: cleanItems(p?.highlights),
          watch: cleanItems(p?.watch),
        }))
      : [];
    return {
      summary: {
        overview: typeof parsed.overview === "string" ? parsed.overview : "",
        programs,
      },
    };
  } catch {
    console.error("aiSummarizeImpact: could not parse Gemini output:", raw.slice(0, 500));
    return { error: "Couldn't parse the AI response. Please try again." };
  }
}
