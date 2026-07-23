import { createAdminClient } from "@/lib/supabase/server";
import { postCompletionDigest, postChannelMessage } from "@/lib/slack";

const NO_PROGRAM = "__none__";

// Posts ONE message per program: tasks + adhoc marked Completed with a
// delivered_date in [from, to], grouped by program then by assignee (with
// @-mentions). Unassigned items are skipped; a program with no completions is
// skipped; unclassified items post last under "No program".
export async function postCompletionDigest_range(opts: {
  from: string;
  to: string;
  label: string; // e.g. "Completed this week (Mon–Fri)"
  appUrl?: string;
}): Promise<{ posted: number; programs: number; people: number; items: number; reason?: string }> {
  const channelId = process.env.SLACK_WEEKLY_CHANNEL_ID;
  if (!channelId) return { posted: 0, programs: 0, people: 0, items: 0, reason: "SLACK_WEEKLY_CHANNEL_ID not set" };

  const admin = createAdminClient();
  const [{ data: tasks }, { data: adhoc }] = await Promise.all([
    admin
      .from("tasks")
      .select("title, program, metrics, delivered_date, assignee:profiles!tasks_assignee_id_fkey ( full_name, email )")
      .eq("status", "Completed")
      .not("delivered_date", "is", null)
      .gte("delivered_date", opts.from)
      .lte("delivered_date", opts.to),
    admin
      .from("adhoc_requests")
      .select("title, module, program, metrics, delivered_date, assignee:profiles!adhoc_requests_assignee_id_fkey ( full_name, email )")
      .eq("status", "Completed")
      .not("delivered_date", "is", null)
      .gte("delivered_date", opts.from)
      .lte("delivered_date", opts.to),
  ]);

  type Item = { title: string; metrics: string[] };
  // program -> (person -> items)
  const byProgram = new Map<string, Map<string, Item[]>>();
  const add = (program: string | null, assignee: any, title: string, metrics: string[]) => {
    const name = assignee?.full_name ?? assignee?.email;
    if (!name || !title) return;
    const key = program || NO_PROGRAM;
    let people = byProgram.get(key);
    if (!people) {
      people = new Map();
      byProgram.set(key, people);
    }
    const list = people.get(name) ?? [];
    list.push({ title, metrics: metrics ?? [] });
    people.set(name, list);
  };
  for (const t of tasks ?? [])
    add((t as any).program, (t as any).assignee, (t as any).title, (t as any).metrics ?? []);
  for (const a of adhoc ?? [])
    add((a as any).program, (a as any).assignee, (a as any).title || (a as any).module || "Adhoc request", (a as any).metrics ?? []);

  if (byProgram.size === 0) return { posted: 0, programs: 0, people: 0, items: 0, reason: "nothing completed" };

  // Named programs alphabetically, "No program" last.
  const keys = Array.from(byProgram.keys()).sort((a, b) => {
    if (a === NO_PROGRAM) return 1;
    if (b === NO_PROGRAM) return -1;
    return a.localeCompare(b);
  });

  // Header once at the top; each program message below carries just its name.
  await postChannelMessage(channelId, `✅ *${opts.label}*  ·  ${opts.from} → ${opts.to}`);

  let posted = 0;
  let people = 0;
  let items = 0;
  for (const key of keys) {
    const peopleMap = byProgram.get(key)!;
    const perPerson = Array.from(peopleMap.entries())
      .map(([name, its]) => ({ name, items: its }))
      .sort((x, y) => y.items.length - x.items.length || x.name.localeCompare(y.name));
    people += perPerson.length;
    items += perPerson.reduce((n, p) => n + p.items.length, 0);

    const progLabel = key === NO_PROGRAM ? "No program" : key;
    const { posted: didPost } = await postCompletionDigest({
      channelId,
      title: `*${progLabel}*`,
      perPerson,
      link: opts.appUrl ? `${opts.appUrl}/summary` : undefined,
    });
    if (didPost) posted++;
  }

  return { posted, programs: keys.length, people, items };
}

// ── IST date helpers (Vercel Cron runs in UTC; we want IST wall-clock dates) ──
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
export function istNow(): Date {
  return new Date(Date.now() + IST_OFFSET_MS);
}
export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function shiftDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
}
export function istDayOfWeek(d: Date): number {
  return d.getUTCDay();
}
