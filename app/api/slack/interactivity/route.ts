import { NextResponse } from "next/server";
import crypto from "crypto";
import { getMessagePermalink, openModal } from "@/lib/slack";

// Handles Slack interactive requests — specifically the "Create Team PM task"
// MESSAGE SHORTCUT. It opens a modal (popup) with a button that launches the
// Team PM new-task form pre-filled with the message text (and a link back to the
// source message). The modal appears instantly wherever you are in the chat — no
// scrolling to a message at the bottom. Point the app's Interactivity Request URL
// at /api/slack/interactivity.
export async function POST(request: Request) {
  const raw = await request.text();

  // Verify the request genuinely came from Slack (signing secret + timestamp).
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (secret) {
    const ts = request.headers.get("x-slack-request-timestamp") ?? "";
    const sig = request.headers.get("x-slack-signature") ?? "";
    const fresh = Math.abs(Date.now() / 1000 - Number(ts)) < 60 * 5; // reject replays
    const expected =
      "v0=" + crypto.createHmac("sha256", secret).update(`v0:${ts}:${raw}`).digest("hex");
    const ok =
      fresh &&
      sig.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    if (!ok) return NextResponse.json({ ok: false }, { status: 401 });
  }

  const payloadStr = new URLSearchParams(raw).get("payload");
  if (!payloadStr) return NextResponse.json({ ok: true });

  let payload: any;
  try {
    payload = JSON.parse(payloadStr);
  } catch {
    return NextResponse.json({ ok: true });
  }

  // Only the message shortcut is handled here.
  if (payload.type !== "message_action") return NextResponse.json({ ok: true });

  const text: string = (payload.message?.text ?? "").slice(0, 2500);
  const channelId: string = payload.channel?.id ?? "";
  const messageTs: string = payload.message?.ts ?? "";
  const triggerId: string | undefined = payload.trigger_id;
  const responseUrl: string | undefined = payload.response_url;

  const permalink = await getMessagePermalink(channelId, messageTs);

  const appUrl = process.env.APP_URL || "https://team-pm-nine.vercel.app";
  const params = new URLSearchParams();
  if (text) params.set("description", text);
  if (permalink) params.set("slack_link", permalink);
  const url = `${appUrl}/tasks?${params.toString()}`;

  // Preferred: pop a modal with an "Open task form" button — instant, centered,
  // no scrolling. A URL button opens the link straight in the browser.
  let opened = false;
  if (triggerId) {
    const clipped = text.length > 300 ? text.slice(0, 300) + "…" : text;
    const quoted = clipped ? `>${clipped.replace(/\n/g, "\n>")}` : "_(no message text)_";
    opened = await openModal(triggerId, {
      type: "modal",
      title: { type: "plain_text", text: "Create Team PM task" },
      close: { type: "plain_text", text: "Close" },
      blocks: [
        { type: "section", text: { type: "mrkdwn", text: "Create a task pre-filled from this message:" } },
        { type: "section", text: { type: "mrkdwn", text: quoted } },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              action_id: "open_task_form",
              text: { type: "plain_text", text: "Open task form ➜", emoji: true },
              url,
              style: "primary",
            },
          ],
        },
      ],
    });
  }

  // Fallback (no trigger_id, or the modal failed): the old ephemeral link.
  if (!opened && responseUrl) {
    await fetch(responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        response_type: "ephemeral",
        text: `➜ <${url}|Open the pre-filled Team PM task form>`,
        unfurl_links: false,
      }),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
