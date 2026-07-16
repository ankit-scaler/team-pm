"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { notifyStatusChange } from "@/lib/slack";
import { syncTaskCalendarEvent, deleteTaskCalendarEvent } from "@/lib/google";
import type { Status } from "@/lib/types";

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
    .select("status, title, created_by, calendar_event_id")
    .eq("id", taskId)
    .single();

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
    .select("status, title, assignee_id")
    .eq("id", taskId)
    .single();

  if (!before) throw new Error("Task not found");

  const update: { status: Status; assignee_id?: string } = { status: newStatus };
  // When someone starts working and nobody owns it yet, they pick it up.
  if (newStatus === "Working" && !before.assignee_id) update.assignee_id = me.id;

  const { error } = await supabase.from("tasks").update(update).eq("id", taskId);
  if (error) throw new Error(error.message);

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
    .select("created_by, calendar_event_id")
    .eq("id", taskId)
    .single();

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

  const { error } = await supabase.from("adhoc_requests").insert({
    source: "manual",
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
    module_owner: str(formData.get("module_owner")),
    stakeholder: str(formData.get("stakeholder")),
    created_by: me.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/adhoc");
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
