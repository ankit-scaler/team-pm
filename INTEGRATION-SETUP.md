# Integration setup — what to create & hand over

Three features are being built:
1. **ETA → calendar block** (Google Calendar) — creator connects calendar; tasks with an ETA create one event (today→ETA) with @scaler.com stakeholders as attendees.
2. **Real Slack @-mentions** (Slack bot) — bot posts digests/status messages, then a **threaded reply** tagging the real people (matched by name against channel members, best-guess).
3. **Adhoc Requests section** (Slack Events API) — real-time capture of `Instructor-flow` messages from `#instructor-adhoc-request-1`, parsed and shown read-only in the UI.

Because we're creating **new** Slack apps, features 2 & 3 will post/read under the new bot (not the old "Instructor Team Task Manager" webhook, which we don't control). The old webhook can be retired once the new bot works.

---

## A) Slack app (covers Task 2 + Task 3)

### A1. Create the app
1. Go to **https://api.slack.com/apps** → **Create New App** → **From scratch**.
2. Name it (e.g. `Team PM Bot`) → pick the **Scaler** workspace → **Create App**.

### A2. Add bot scopes
**OAuth & Permissions → Scopes → Bot Token Scopes**, add:
- `chat:write` — post messages + threaded replies
- `channels:read` — list channel members (for name matching)
- `channels:history` — read messages (Task 3)
- `users:read` — resolve member names for matching
- (add `groups:read` + `groups:history` too **only if** either channel is private)

> Note: we're matching by **name**, not email, so `users:read.email` is NOT needed.

### A3. Install
1. **OAuth & Permissions → Install to Workspace → Allow.**
   - If your workspace requires admin approval to install apps, an admin has to click approve once. You don't need to be an admin to *build* the app.
2. Copy the **Bot User OAuth Token** (starts `xoxb-`). → **`SLACK_BOT_TOKEN`**

### A4. Grab the signing secret (needed for Task 3 events)
**Basic Information → App Credentials → Signing Secret → Show → copy.** → **`SLACK_SIGNING_SECRET`**

### A5. Invite the bot to both channels
In Slack, in each channel type:
```
/invite @Team PM Bot
```
- `#instructor-team-task-status-updates` (Task 2 — where digests post)
- `#instructor-adhoc-request-1` (Task 3 — where adhoc requests come from)

### A6. Get the channel IDs
For each channel: click the channel name at the top → scroll to the bottom of the popup → copy the **Channel ID** (looks like `C0123ABCD`).
- `#instructor-team-task-status-updates` → **`SLACK_STATUS_CHANNEL_ID`**
- `#instructor-adhoc-request-1` → **`SLACK_ADHOC_CHANNEL_ID`**

### A7. Events API — DO THIS AFTER I DEPLOY (Task 3)
The request URL must be live before Slack will accept it, so this is the **last** step, after I've built + you've deployed the `/api/slack/events` endpoint.
1. **Event Subscriptions → Enable Events.**
2. **Request URL:** `https://<your-app-domain>/api/slack/events` → wait for the green **Verified**.
3. **Subscribe to bot events →** add `message.channels` (and `message.groups` if the adhoc channel is private).
4. **Save**, then reinstall the app if prompted.

---

## B) Google Calendar (Task 1)

### B1. Enable the API
Google Cloud Console → your project → **APIs & Services → Library → search "Google Calendar API" → Enable.**

### B2. Create an OAuth client
**APIs & Services → Credentials → Create Credentials → OAuth client ID → Web application.**
- **Authorized redirect URIs** — add both:
  - `https://<your-app-domain>/api/google/callback`
  - `http://localhost:3000/api/google/callback`
- Create → copy **Client ID** → **`GOOGLE_CLIENT_ID`**, **Client secret** → **`GOOGLE_CLIENT_SECRET`**.

### B3. Consent screen + scope
**APIs & Services → OAuth consent screen** — make sure **User type = Internal** (Workspace). Add the scope:
- `https://www.googleapis.com/auth/calendar.events`

Internal apps skip Google's verification for this scope, so nothing to wait on.

---

## C) Hand these values to me

Paste this filled in (or drop them into `.env.local` yourself — it's gitignored):

```
# Slack (Tasks 2 & 3)
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_STATUS_CHANNEL_ID=C...
SLACK_ADHOC_CHANNEL_ID=C...

# Google Calendar (Task 1)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Your deployed app URL (for redirect + events URLs)
APP_URL=https://<your-app-domain>
```

Also tell me your **deployed app domain** so I can set the exact redirect/events URLs.

---

## Order of operations
1. You do **A1–A6** and **B** → hand me the values above. (I can start building immediately with just these.)
2. I build all three features + endpoints.
3. You deploy (add the env vars in Vercel too).
4. You finish **A7** (Events API request URL) against the live deploy → Task 3 goes live.

Nothing blocks me from writing the code today — the token/config just gets plugged in.
