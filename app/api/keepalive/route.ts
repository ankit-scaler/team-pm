import { createAdminClient } from "@/lib/supabase/server";
import { notifyOverdue } from "@/lib/slack";
import { NextResponse } from "next/server";

// Hit daily by Vercel Cron (see vercel.json). Two jobs in one:
//  1) keep the free Supabase project from auto-pausing (a trivial query)
//  2) post a Slack digest of tasks whose ETA has passed and aren't completed
// Vercel sends Authorization: Bearer <CRON_SECRET>.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  try {
    const supabase = createAdminClient();

    // 1) keep-alive
    await supabase.from("profiles").select("id", { count: "exact", head: true });

    // 2) overdue ETA digest (today or earlier, not completed)
    const today = new Date().toISOString().slice(0, 10);
    const { data: overdue } = await supabase
      .from("tasks")
      .select(`title, eta, assignee:profiles!tasks_assignee_id_fkey ( full_name, email )`)
      .neq("status", "Completed")
      .not("eta", "is", null)
      .lte("eta", today)
      .order("eta", { ascending: true });

    const items = (overdue ?? []).map((t: any) => ({
      title: t.title,
      eta: t.eta,
      assignee: t.assignee?.full_name ?? t.assignee?.email ?? null,
    }));

    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
    await notifyOverdue(items, host ? `${proto}://${host}` : undefined);

    return NextResponse.json({ ok: true, overdue: items.length, ranAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
