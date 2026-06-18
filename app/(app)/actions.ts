"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { notifyStatusChange } from "@/lib/slack";
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

// Dedupe + clean the tags submitted from the form.
function parseTags(formData: FormData): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of formData.getAll("tags")) {
    const s = v.toString().trim();
    if (s && !seen.has(s.toLowerCase())) {
      seen.add(s.toLowerCase());
      out.push(s);
    }
  }
  return out;
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
      tags: parseTags(formData),
      created_by: me.id,
    })
    .select("id, title, status")
    .single();

  if (error || !task) throw new Error(error?.message ?? "Could not create task");

  await syncStakeholders(task.id, stakeholderIds);

  await notifyStatusChange({
    taskTitle: task.title,
    taskId: task.id,
    oldStatus: null,
    newStatus: task.status as Status,
    actorName: me.name,
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
    .select("status, title")
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
      tags: parseTags(formData),
    })
    .eq("id", taskId);

  if (error) throw new Error(error.message);

  await syncStakeholders(taskId, stakeholderIds);

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
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw new Error(error.message);
  revalidatePath("/board");
  revalidatePath("/tasks");
  revalidatePath("/people");
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
