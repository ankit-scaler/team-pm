import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { isAdhocRequest, parseAdhocMessage } from "@/lib/adhoc";

// Slack Events endpoint (Task 3). Receives messages from #instructor-adhoc-request-1,
// parses the Instructor-flow adhoc form, and stores it for the read-only UI.
// Runs its own auth via Slack's request signature — no session needed.

export const dynamic = "force-dynamic";

function verifySignature(raw: string, ts: string | null, sig: string | null): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) return false;
  if (!ts || !sig) return false;
  const tsNum = Number(ts);
  // Reject non-numeric or stale (>5 min) timestamps to prevent replay.
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 60 * 5) return false;
  const base = `v0:${ts}:${raw}`;
  const expected = "v0=" + crypto.createHmac("sha256", secret).update(base).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

async function slackApi(method: string, params: Record<string, string>) {
  const token = process.env.SLACK_BOT_TOKEN;
  const res = await fetch(`https://slack.com/api/${method}?${new URLSearchParams(params)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

// Resolve <@U123> / <@U123|handle> tokens to readable @names.
const userNameCache = new Map<string, string>();
async function resolveMentions(text: string): Promise<string> {
  const ids = Array.from(text.matchAll(/<@([A-Z0-9]+)(?:\|[^>]+)?>/g)).map((m) => m[1]);
  const unique = Array.from(new Set(ids));
  // Resolve in parallel to stay well under Slack's ~3s ack deadline.
  await Promise.all(
    unique
      .filter((id) => !userNameCache.has(id))
      .map(async (id) => {
        const r = await slackApi("users.info", { user: id });
        const p = r?.user?.profile ?? {};
        userNameCache.set(id, r?.user?.real_name ?? p.display_name ?? p.real_name ?? id);
      })
  );
  return text.replace(/<@([A-Z0-9]+)(?:\|[^>]+)?>/g, (_m, id) => `@${userNameCache.get(id) ?? id}`);
}

export async function POST(request: Request) {
  const raw = await request.text();
  const ts = request.headers.get("x-slack-request-timestamp");
  const sig = request.headers.get("x-slack-signature");

  if (!verifySignature(raw, ts, sig)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Slack's one-time endpoint verification handshake.
  if (payload.type === "url_verification") {
    return NextResponse.json({ challenge: payload.challenge });
  }

  if (payload.type === "event_callback") {
    try {
      await handleEvent(payload.event);
    } catch (e) {
      // Return non-2xx so Slack redelivers; storage is idempotent (unique
      // slack_ts), so a retry can't create duplicates.
      console.error("slack events handler error:", e);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

async function handleEvent(event: any) {
  if (!event || event.type !== "message") return;

  const adhocChannel = process.env.SLACK_ADHOC_CHANNEL_ID;
  if (!adhocChannel || event.channel !== adhocChannel) return;

  // Only fresh top-level posts (skip edits/deletes/thread replies).
  const skip = ["message_changed", "message_deleted", "thread_broadcast"];
  if (event.subtype && skip.includes(event.subtype)) return;
  if (event.thread_ts && event.thread_ts !== event.ts) return;

  const rawText: string = event.text ?? "";
  if (!rawText) return;

  const text = await resolveMentions(rawText);
  if (!isAdhocRequest(text)) return;

  const fields = parseAdhocMessage(text);

  const admin = createAdminClient();

  // Best-effort permalink to the original message.
  let permalink: string | null = null;
  try {
    const r = await slackApi("chat.getPermalink", {
      channel: event.channel,
      message_ts: event.ts,
    });
    if (r?.ok) permalink = r.permalink;
  } catch {
    /* non-fatal */
  }

  const posted_at = event.ts ? new Date(Number(event.ts) * 1000).toISOString() : null;

  await admin.from("adhoc_requests").upsert(
    {
      slack_ts: event.ts,
      slack_channel: event.channel,
      permalink,
      posted_at,
      raw: fields as any,
      ...fields,
    },
    { onConflict: "slack_ts" }
  );
}
