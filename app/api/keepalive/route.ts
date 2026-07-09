import { createAdminClient } from "@/lib/supabase/server";
import { notifyOverdue, notifyDueSoon } from "@/lib/slack";
import { NextResponse } from "next/server";

// Hit daily by Vercel Cron (see vercel.json). Three jobs in one:
//  1) keep the free Supabase project from auto-pausing (a trivial query)
//  2) post a Slack digest of tasks whose ETA has passed and aren't completed
//  3) post a Slack reminder for tasks whose ETA is tomorrow and aren't completed
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

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // 2) overdue ETA digest (today or earlier, not completed)
    const { data: overdue } = await supabase
      .from("tasks")
      .select(`title, eta, assignee:profiles!tasks_assignee_id_fkey ( full_name, email )`)
      .neq("status", "Completed")
      .not("eta", "is", null)
      .lte("eta", today)
      .order("eta", { ascending: true });

    // 3) due-tomorrow reminder (ETA is exactly tomorrow, not completed)
    const { data: dueSoon } = await supabase
      .from("tasks")
      .select(`title, eta, assignee:profiles!tasks_assignee_id_fkey ( full_name, email )`)
      .neq("status", "Completed")
      .eq("eta", tomorrow)
      .order("eta", { ascending: true });

    const mapItems = (rows: any[] | null) =>
      (rows ?? []).map((t: any) => ({
        title: t.title,
        eta: t.eta,
        assignee: t.assignee?.full_name ?? t.assignee?.email ?? null,
      }));

    const overdueItems = mapItems(overdue);
    const dueSoonItems = mapItems(dueSoon);

    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
    const appUrl = host ? `${proto}://${host}` : undefined;

    await notifyOverdue(overdueItems, appUrl);
    await notifyDueSoon(dueSoonItems, appUrl);

    return NextResponse.json({
      ok: true,
      overdue: overdueItems.length,
      dueSoon: dueSoonItems.length,
      ranAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
