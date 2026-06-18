"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
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
