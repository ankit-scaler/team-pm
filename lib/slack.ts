import type { Status } from "./types";

type StatusChangePayload = {
  taskTitle: string;
  taskId: string;
  oldStatus: Status | null;
  newStatus: Status;
  actorName: string;
  appUrl?: string;
};

const STATUS_EMOJI: Record<Status, string> = {
  "To pick": "🗂️",
  Working: "🛠️",
  "In Review": "🔍",
  Completed: "✅",
};

// Fire-and-forget Slack Incoming Webhook notification. Never throws into the request path.
export async function notifyStatusChange(p: StatusChangePayload): Promise<void> {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) return;

  const link = p.appUrl ? `${p.appUrl}/tasks` : undefined;

  const text = p.oldStatus
    ? `${STATUS_EMOJI[p.newStatus]} *${p.taskTitle}* moved *${p.oldStatus}* → *${p.newStatus}* by ${p.actorName}`
    : `🆕 New task *${p.taskTitle}* added (status: *${p.newStatus}*) by ${p.actorName}`;

  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        blocks: [
          {
            type: "section",
            text: { type: "mrkdwn", text },
          },
          ...(link
            ? [
                {
                  type: "context",
                  elements: [{ type: "mrkdwn", text: `<${link}|Open the board>` }],
                },
              ]
            : []),
        ],
      }),
    });
  } catch (e) {
    console.error("Slack notify failed:", e);
  }
}
