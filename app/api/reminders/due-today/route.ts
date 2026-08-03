import { createAdminClient } from "@/lib/supabase/server";
import { dmUserByEmail } from "@/lib/slack";
import { NextResponse } from "next/server";

// Additive daily job: DM every user who has an incomplete task due TODAY a
// personalised reminder listing their tasks. Independent of the channel digests
// in /api/keepalive — nothing there is touched.
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
    const admin = createAdminClient();
    // "Today" in the team's timezone (IST) as YYYY-MM-DD, matched against eta.
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

    const { data } = await admin
      .from("tasks")
      .select(`title, eta, assignee:profiles!tasks_assignee_id_fkey ( full_name, email )`)
      .neq("status", "Completed")
      .eq("eta", today)
      .order("title", { ascending: true });

    // Group tasks by the assignee's email (skip unassigned).
    const byUser = new Map<string, { name: string; titles: string[] }>();
    for (const t of (data ?? []) as any[]) {
      const email: string | undefined = t.assignee?.email;
      if (!email) continue;
      const g = byUser.get(email) ?? { name: (t.assignee?.full_name ?? email) as string, titles: [] as string[] };
      g.titles.push(t.title as string);
      byUser.set(email, g);
    }

    let sent = 0;
    for (const [email, g] of Array.from(byUser.entries())) {
      const firstName = (g.name ?? "").trim().split(/\s+/)[0] || "there";
      const n = g.titles.length;
      const lines = g.titles.map((t) => `•  ${t}`).join("\n");
      const text =
        `👋 Hi ${firstName}, you have *${n}* task${n === 1 ? "" : "s"} due *today*:\n` +
        `${lines}\n\n` +
        `If any are done or need a new date, please update them on the board 🙏`;
      if (await dmUserByEmail(email, text)) sent++;
    }

    return NextResponse.json({ ok: true, date: today, users: byUser.size, sent });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
