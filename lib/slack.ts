import type { Status } from "./types";

// -----------------------------------------------------------------------------
//  Slack integration
//
//  If SLACK_BOT_TOKEN + SLACK_STATUS_CHANNEL_ID are set, we post via the Web API
//  (chat.postMessage) so we can capture the message ts and then post a THREADED
//  reply that @-mentions the real people referenced in the message (Task 2).
//  People are found by scanning the message text for "(Name)" brackets and
//  fuzzy-matching each against the channel's members — best-guess, no email.
//
//  If no bot token is set, we fall back to the legacy Incoming Webhook (no
//  threading / no mentions). Everything is fire-and-forget: it never throws.
// -----------------------------------------------------------------------------

const STATUS_EMOJI: Record<Status, string> = {
  "To pick": "📌",
  Working: "🛠️",
  "In Review": "🔍",
  Completed: "✅",
};

function botToken() {
  return process.env.SLACK_BOT_TOKEN;
}
function statusChannel() {
  return process.env.SLACK_STATUS_CHANNEL_ID;
}

async function slackApi(method: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${botToken()}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) console.error(`Slack ${method} failed:`, json.error);
  return json;
}

// ---------------- Channel member resolution (for @-mentions) ----------------

type Member = { id: string; names: string[] };
let membersCache: { at: number; channel: string; members: Member[] } | null = null;
const MEMBERS_TTL = 10 * 60 * 1000; // 10 min

// Slack's read methods (conversations.members, users.info) reject a JSON body —
// they must be called with query params, so use GET. (chat.postMessage, below,
// keeps using slackApi/JSON, which it does support.)
async function slackGet(method: string, params: Record<string, string | number>): Promise<any> {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  ).toString();
  const res = await fetch(`https://slack.com/api/${method}?${qs}`, {
    headers: { Authorization: `Bearer ${botToken()}` },
  });
  const json = await res.json();
  if (!json.ok) console.error(`Slack ${method} failed:`, json.error);
  return json;
}

async function getChannelMembers(channel: string): Promise<Member[]> {
  if (membersCache && membersCache.channel === channel && Date.now() - membersCache.at < MEMBERS_TTL) {
    return membersCache.members;
  }
  if (!botToken()) return [];

  // Who's in the channel? (GET — this read method rejects a JSON body.)
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const r = await slackGet("conversations.members", {
      channel,
      limit: 200,
      ...(cursor ? { cursor } : {}),
    });
    if (!r.ok) break;
    ids.push(...((r.members as string[]) ?? []));
    cursor = r.response_metadata?.next_cursor || undefined;
  } while (cursor);

  // Resolve each member's names via users.info — bounded by channel size, so we
  // avoid paginating the whole workspace with users.list (slow / rate-limited).
  const members: Member[] = [];
  for (const id of ids) {
    const r = await slackGet("users.info", { user: id });
    const u = r.user;
    if (!r.ok || !u || u.deleted || u.is_bot) continue;
    const p = u.profile ?? {};
    const names = [u.real_name, p.real_name, p.display_name, p.display_name_normalized, u.name]
      .filter(Boolean) as string[];
    members.push({ id, names });
  }

  membersCache = { at: Date.now(), channel, members };
  return members;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, " ") // drop parentheticals like "(FS)"
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Score how well a bracketed name matches a member's known names (0..1).
function matchScore(name: string, member: Member): number {
  const target = normalize(name);
  if (!target) return 0;
  const targetTokens = target.split(" ").filter(Boolean);
  let best = 0;
  for (const raw of member.names) {
    const cand = normalize(raw);
    if (!cand) continue;
    if (cand === target) return 1;
    const candTokens = new Set(cand.split(" ").filter(Boolean));
    let overlap = 0;
    for (const t of targetTokens) if (candTokens.has(t)) overlap++;
    let s = overlap / Math.max(targetTokens.length, 1);
    if (cand.includes(target) || target.includes(cand)) s = Math.max(s, 0.85);
    best = Math.max(best, s);
  }
  return best;
}

// Best-guess: return the closest member id (requires at least some overlap).
function bestMatch(name: string, members: Member[]): string | null {
  let bestId: string | null = null;
  let bestScore = 0;
  for (const m of members) {
    const s = matchScore(name, m);
    if (s > bestScore) {
      bestScore = s;
      bestId = m.id;
    }
  }
  return bestScore > 0 ? bestId : null;
}

// Pull plausible person names out of "(...)" brackets in the message text.
// Skips non-name parentheticals like "(status: In Review)" / "(unassigned, …)".
function parseBracketNames(text: string): string[] {
  const out: string[] = [];
  const re = /\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const inner = m[1].trim();
    if (!/^[A-Za-z][A-Za-z .]{1,39}$/.test(inner)) continue; // letters/space/dot only
    if (/status|unassigned/i.test(inner)) continue;
    out.push(inner);
  }
  return out;
}

// Resolve the bracketed names in `text` to Slack user ids, deduped.
async function resolveMentionIds(tagNames: string[] | undefined, text: string): Promise<string[]> {
  const channel = statusChannel();
  if (!channel) return [];
  // Prefer explicit people to tag; otherwise fall back to names in (brackets).
  const names = tagNames && tagNames.length > 0 ? tagNames : parseBracketNames(text);
  if (names.length === 0) return [];
  const members = await getChannelMembers(channel);
  if (members.length === 0) return [];
  const ids = new Set<string>();
  for (const n of names) {
    const id = bestMatch(n, members);
    if (id) ids.add(id);
  }
  return Array.from(ids);
}

// ---------------- Delivery ----------------

function sectionBlocks(text: string, link?: string) {
  return [
    { type: "section", text: { type: "mrkdwn", text } },
    ...(link
      ? [{ type: "context", elements: [{ type: "mrkdwn", text: `<${link}|Open the board>` }] }]
      : []),
  ];
}

// Post a message and tag the relevant people in a threaded reply.
async function deliver(
  text: string,
  opts: { link?: string; tagNames?: string[] } = {}
): Promise<void> {
  const channel = statusChannel();

  // Preferred path: bot token + Web API (enables threading + mentions).
  if (botToken() && channel) {
    try {
      const posted = await slackApi("chat.postMessage", {
        channel,
        text,
        blocks: sectionBlocks(text, opts.link),
      });
      const ts = posted?.ts;
      if (!ts) return;

      const ids = await resolveMentionIds(opts.tagNames, text);
      if (ids.length > 0) {
        await slackApi("chat.postMessage", {
          channel,
          thread_ts: ts,
          text: `cc ${ids.map((id) => `<@${id}>`).join(" ")}`,
        });
      }
    } catch (e) {
      console.error("Slack deliver (bot) failed:", e);
    }
    return;
  }

  // Fallback: legacy Incoming Webhook (no threading / mentions).
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, blocks: sectionBlocks(text, opts.link) }),
    });
  } catch (e) {
    console.error("Slack webhook failed:", e);
  }
}

// ---------------- Public API (unchanged signatures) ----------------

type StatusChangePayload = {
  taskTitle: string;
  taskId: string;
  oldStatus: Status | null;
  newStatus: Status;
  actorName: string;
  assigneeName?: string | null;
  appUrl?: string;
};

export async function notifyStatusChange(p: StatusChangePayload): Promise<void> {
  const link = p.appUrl ? `${p.appUrl}/tasks` : undefined;

  let text: string;
  let tagNames: string[] = [];
  if (p.oldStatus) {
    // Status change ("moved") — no @-mention (per the agreed rules).
    text = `${STATUS_EMOJI[p.newStatus]} *${p.taskTitle}* moved *${p.oldStatus}* → *${p.newStatus}* by ${p.actorName}`;
  } else if (p.assigneeName && p.assigneeName !== p.actorName) {
    // New task raised for someone else → tag BOTH the raiser and the assignee.
    text = `🆕 *${p.taskTitle}* raised by *${p.actorName}* → assigned to *${p.assigneeName}* (status: *${p.newStatus}*)`;
    tagNames = [p.actorName, p.assigneeName];
  } else if (p.assigneeName) {
    text = `🆕 *${p.taskTitle}* added by *${p.actorName}* (status: *${p.newStatus}*)`;
    tagNames = [p.actorName];
  } else {
    text = `🆕 *${p.taskTitle}* raised by *${p.actorName}* (unassigned, status: *${p.newStatus}*)`;
    tagNames = [p.actorName];
  }

  await deliver(text, { link, tagNames });
}

type OverdueItem = { title: string; eta: string; assignee: string | null };

export async function notifyOverdue(items: OverdueItem[], appUrl?: string): Promise<void> {
  if (items.length === 0) return;
  const lines = items
    .map((i) => `• *${i.title}* — ETA ${i.eta}${i.assignee ? ` (${i.assignee})` : ""}`)
    .join("\n");
  const header = `🆘⏰ *${items.length} task${items.length > 1 ? "s" : ""} past ETA and not completed*`;
  const tagNames = items.map((i) => i.assignee).filter(Boolean) as string[];
  await deliver(`${header}\n${lines}`, { link: appUrl ? `${appUrl}/tasks` : undefined, tagNames });
}

export async function notifyDueSoon(items: OverdueItem[], appUrl?: string): Promise<void> {
  if (items.length === 0) return;
  const lines = items
    .map((i) => `• *${i.title}* — ETA ${i.eta}${i.assignee ? ` (${i.assignee})` : ""}`)
    .join("\n");
  const header = `🆘📅 *${items.length} task${items.length > 1 ? "s" : ""} due tomorrow*`;
  const tagNames = items.map((i) => i.assignee).filter(Boolean) as string[];
  await deliver(`${header}\n${lines}`, { link: appUrl ? `${appUrl}/tasks` : undefined, tagNames });
}
