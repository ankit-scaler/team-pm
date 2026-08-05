import { createAdminClient } from "@/lib/supabase/server";
import { dmUserByEmail } from "@/lib/slack";
import { NextResponse } from "next/server";

// Additive daily job: DM each person with time-sensitive work a personalised,
// well-structured snapshot — Overdue, Due today, then ALL their open tasks
// bucketed by priority (P0–P3) with effort. Independent of the channel digests
// in /api/keepalive. Vercel sends Authorization: Bearer <CRON_SECRET>.

type T = { id: string; title: string; eta: string | null; priority: string | null; effort: string | null };

function fmtShort(iso: string | null): string {
  if (!iso) return "no ETA";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
// "ETA Aug 5" when dated, plain "no ETA" otherwise.
const etaLabel = (iso: string | null) => (iso ? `ETA ${fmtShort(iso)}` : "no ETA");

// Priority → P-level buckets (highest first). Unknown priorities fall to "Other".
const BUCKETS: { key: string; label: string }[] = [
  { key: "Urgent", label: "P0 · Urgent" },
  { key: "High", label: "P1 · High" },
  { key: "Medium", label: "P2 · Medium" },
  { key: "Low", label: "P3 · Low" },
];

function buildMessage(name: string, tasks: T[], today: string): string {
  const first = (name ?? "").trim().split(/\s+/)[0] || "there";
  const overdue = tasks.filter((t) => t.eta && t.eta < today);
  const dueToday = tasks.filter((t) => t.eta === today);

  let msg = `👋 Hi ${first}, here's your Team PM snapshot for today:`;

  if (overdue.length) {
    msg +=
      `\n\n🔴 *Overdue — ${overdue.length}*\n` +
      overdue.map((t) => `•  ${t.title}  _(was due ${fmtShort(t.eta)})_`).join("\n");
  }
  if (dueToday.length) {
    msg += `\n\n🟡 *Due today — ${dueToday.length}*\n` + dueToday.map((t) => `•  ${t.title}`).join("\n");
  }

  msg += `\n\n📋 *All open tasks by priority*`;
  const seen = new Set<string>();
  for (const b of BUCKETS) {
    const items = tasks.filter((t) => (t.priority ?? "") === b.key);
    if (!items.length) continue;
    items.forEach((t) => seen.add(t.id));
    msg +=
      `\n\n*${b.label} — ${items.length}*\n` +
      items
        .map((t) => `•  ${t.title}  ·  ${etaLabel(t.eta)}${t.effort ? `  ·  ${t.effort} effort` : ""}`)
        .join("\n");
  }
  const others = tasks.filter((t) => !seen.has(t.id));
  if (others.length) {
    msg +=
      `\n\n*Other — ${others.length}*\n` +
      others.map((t) => `•  ${t.title}  ·  ${etaLabel(t.eta)}`).join("\n");
  }

  msg += `\n\n_Please keep the board updated so this stays accurate 🙏_`;
  return msg;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  try {
    // Test controls: ?only=<email> restricts to one recipient; ?dry=1 composes
    // the messages and returns them WITHOUT sending anything.
    const url = new URL(request.url);
    const only = (url.searchParams.get("only") ?? "").trim().toLowerCase() || null;
    const dry = ["1", "true", "yes"].includes((url.searchParams.get("dry") ?? "").toLowerCase());
    const force = ["1", "true", "yes"].includes((url.searchParams.get("force") ?? "").toLowerCase());

    // Anti-spam guard: only ACTUALLY send when this is the real Vercel Cron
    // (its requests carry a "vercel-cron" user-agent) or when ?force=1 is set.
    // A casual manual hit just returns a preview — so testing can never DM the
    // team by accident.
    const isCron = (request.headers.get("user-agent") ?? "").toLowerCase().includes("vercel-cron");
    const willSend = !dry && (isCron || force);

    const admin = createAdminClient();
    // "Today" in the team's timezone (IST) as YYYY-MM-DD, matched against eta.
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

    const { data } = await admin
      .from("tasks")
      .select(`id, title, eta, priority, effort, assignee:profiles!tasks_assignee_id_fkey ( full_name, email )`)
      .neq("status", "Completed")
      .order("eta", { ascending: true, nullsFirst: false });

    // Group every open task by the assignee's email (skip unassigned). One DM
    // per email, so a person is never messaged twice.
    const byUser = new Map<string, { name: string; tasks: T[] }>();
    for (const t of (data ?? []) as any[]) {
      const email: string | undefined = t.assignee?.email;
      if (!email) continue;
      const g = byUser.get(email) ?? { name: (t.assignee?.full_name ?? email) as string, tasks: [] as T[] };
      g.tasks.push({ id: t.id, title: t.title, eta: t.eta, priority: t.priority, effort: t.effort });
      byUser.set(email, g);
    }

    let sent = 0;
    const preview: { email: string; text: string }[] = [];
    for (const [email, g] of Array.from(byUser.entries())) {
      if (only && email.toLowerCase() !== only) continue; // targeted test
      const text = buildMessage(g.name, g.tasks, today);
      if (!willSend) {
        preview.push({ email, text }); // nothing sent (dry, or not the real cron)
        continue;
      }
      // Everyone with at least one open task gets their prioritised snapshot.
      if (await dmUserByEmail(email, text)) sent++;
    }

    return NextResponse.json({
      ok: true,
      date: today,
      users: byUser.size,
      sent,
      ...(willSend ? {} : { sentNothing: true, reason: dry ? "dry" : "not the scheduled cron — pass ?force=1 to send", preview }),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
