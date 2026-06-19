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

type OverdueItem = { title: string; eta: string; assignee: string | null };

// Daily digest of tasks whose ETA has passed (or is today) and aren't completed.
export async function notifyOverdue(items: OverdueItem[], appUrl?: string): Promise<void> {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook || items.length === 0) return;

  const lines = items
    .map((i) => `• *${i.title}* — ETA ${i.eta}${i.assignee ? ` (_${i.assignee}_)` : ""}`)
    .join("\n");
  const header = `⏰ *${items.length} task${items.length > 1 ? "s" : ""} past ETA and not completed*`;
  const link = appUrl ? `${appUrl}/tasks` : undefined;

  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `${header}\n${lines}`,
        blocks: [
          { type: "section", text: { type: "mrkdwn", text: `${header}\n${lines}` } },
          ...(link
            ? [{ type: "context", elements: [{ type: "mrkdwn", text: `<${link}|Open the board>` }] }]
            : []),
        ],
      }),
    });
  } catch (e) {
    console.error("Slack overdue notify failed:", e);
  }
}
