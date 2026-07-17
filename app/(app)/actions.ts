"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { notifyStatusChange } from "@/lib/slack";
import { syncTaskCalendarEvent, deleteTaskCalendarEvent } from "@/lib/google";
import { getMyAccess } from "@/lib/access";
import type { MembershipRole } from "@/lib/access";
import type { Status } from "@/lib/types";

// RBAC guard: a non-admin may only act within programs they belong to.
async function assertProgramAllowed(program: string | null) {
  const access = await getMyAccess();
  if (access.isAdmin) return;
  if (!program || !access.visiblePrograms.includes(program)) {
    throw new Error("You don't have access to that program.");
  }
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

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      title: str(formData.get("title")) ?? "Untitled task",
      description: str(formData.get("description")),
      eta: str(formData.get("eta")),
      status,
      effort: str(formData.get("effort")),
      priority: str(formData.get("priority")) ?? "Medium",
      assignee_id: str(formData.get("assignee_id")),
      delivered_date: str(formData.get("delivered_date")),
      tags: parseMultiValue(formData, "tags"),
      metrics: parseMultiValue(formData, "metrics"),
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
  const eta = str(formData.get("eta"));
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

  revalidatePath("/board");
  revalidatePath("/tasks");
  revalidatePath("/people");
}

export async function updateTask(taskId: string, formData: FormData) {
  const supabase = createClient();
  const me = await currentProfile();

  const { data: before } = await supabase
    .from("tasks")
    .select("status, title, created_by, calendar_event_id, program")
    .eq("id", taskId)
    .single();

  await assertProgramAllowed(before?.program ?? null);
  // Also block moving the task INTO a program the caller isn't in.
  await assertProgramAllowed(str(formData.get("program")));

  const newStatus = (str(formData.get("status")) ?? "To pick") as Status;
  const stakeholderIds = formData.getAll("stakeholders").map(String).filter(Boolean);

  const { error } = await supabase
    .from("tasks")
    .update({
      title: str(formData.get("title")) ?? "Untitled task",
      description: str(formData.get("description")),
      eta: str(formData.get("eta")),
      status: newStatus,
      effort: str(formData.get("effort")),
      priority: str(formData.get("priority")) ?? "Medium",
      assignee_id: str(formData.get("assignee_id")),
      delivered_date: str(formData.get("delivered_date")),
      tags: parseMultiValue(formData, "tags"),
      metrics: parseMultiValue(formData, "metrics"),
      slack_link: str(formData.get("slack_link")),
      sheet_link: str(formData.get("sheet_link")),
      program: str(formData.get("program")),
      track: str(formData.get("track")),
    })
    .eq("id", taskId);

  if (error) throw new Error(error.message);

  await syncStakeholders(taskId, stakeholderIds);

  // Task 1: keep the calendar block in sync with the ETA / completion.
  const newEta = str(formData.get("eta"));
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
    .select("status, title, assignee_id, created_by, calendar_event_id, program")
    .eq("id", taskId)
    .single();

  if (!before) throw new Error("Task not found");
  await assertProgramAllowed(before.program ?? null);

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
  }

  revalidatePath("/board");
  revalidatePath("/tasks");
  revalidatePath("/people");
}

export async function deleteTask(taskId: string) {
  const supabase = createClient();
  const { data: before } = await supabase
    .from("tasks")
    .select("created_by, calendar_event_id, program")
    .eq("id", taskId)
    .single();

  await assertProgramAllowed(before?.program ?? null);

  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw new Error(error.message);

  // Task 1: remove any calendar block for this task.
  if (before?.calendar_event_id) {
    await deleteTaskCalendarEvent(before.created_by ?? null, before.calendar_event_id);
  }

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

  const eta = str(formData.get("eta"));
  const assigneeId = str(formData.get("assignee_id"));
  const moduleOwner = await nameForProfile(assigneeId); // keep text in sync with assignee
  const stakeholder = str(formData.get("stakeholder"));

  const { data: created, error } = await supabase
    .from("adhoc_requests")
    .insert({
      source: "manual",
      status: (str(formData.get("status")) ?? "To pick") as Status,
      eta,
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

  revalidatePath("/adhoc");
  revalidatePath("/board");
}

// Edit an adhoc request (e.g. add the ETA/status to a Slack-fetched one).
export async function updateAdhocRequest(id: string, formData: FormData) {
  const supabase = createClient();
  await currentProfile();

  const { data: before } = await supabase
    .from("adhoc_requests")
    .select("created_by, calendar_event_id, program")
    .eq("id", id)
    .single();

  await assertProgramAllowed(before?.program ?? null);
  // Also block relabelling the request INTO a program the caller isn't in.
  await assertProgramAllowed(str(formData.get("program")));

  const status = (str(formData.get("status")) ?? "To pick") as Status;
  const eta = str(formData.get("eta"));
  const title = str(formData.get("title"));
  const assigneeId = str(formData.get("assignee_id"));
  const moduleOwner = await nameForProfile(assigneeId);
  const stakeholder = str(formData.get("stakeholder"));

  const { error } = await supabase
    .from("adhoc_requests")
    .update({
      status,
      eta,
      title,
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

  revalidatePath("/adhoc");
  revalidatePath("/board");
}

// Move an adhoc request across stages from the Board.
export async function changeAdhocStatus(id: string, newStatus: Status) {
  const supabase = createClient();
  await currentProfile(); // ensure signed in

  const { data: before } = await supabase
    .from("adhoc_requests")
    .select("created_by, calendar_event_id, program")
    .eq("id", id)
    .single();

  await assertProgramAllowed(before?.program ?? null);

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

  revalidatePath("/board");
  revalidatePath("/adhoc");
}

// Delete an adhoc request (and release any calendar block it created).
export async function deleteAdhocRequest(id: string) {
  const supabase = createClient();
  await currentProfile();
  const { data: before } = await supabase
    .from("adhoc_requests")
    .select("created_by, calendar_event_id, program")
    .eq("id", id)
    .single();

  await assertProgramAllowed(before?.program ?? null);

  const { error } = await supabase.from("adhoc_requests").delete().eq("id", id);
  if (error) throw new Error(error.message);

  if (before?.calendar_event_id) {
    await deleteTaskCalendarEvent(before.created_by ?? null, before.calendar_event_id);
  }
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

  revalidatePath("/admin");
  revalidatePath("/board");
  revalidatePath("/tasks");
  revalidatePath("/adhoc");
}

// Remove a program membership. Admins can remove any; MOs only 'user' rows in their programs.
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

  revalidatePath("/admin");
  revalidatePath("/board");
}

export async function deleteUser(userId: string) {
  const adminId = await requireAdmin();
  if (userId === adminId) throw new Error("You can't delete your own account here.");

  // Removing the auth user cascades to their profile; their tasks stay but
  // become unassigned (assignee/created_by are set to null by the DB).
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);

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
  revalidatePath("/admin");
}
