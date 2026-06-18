# Team PM

A free, self-hosted project-management tool for an internal team. Built with **Next.js 14 + Supabase**. Includes tasks (status, ETA, effort, priority, stakeholders, delivered date), a Kanban board, a filterable table, per-person reporting, Google sign-in, light/dark mode, and Slack notifications on status changes.

---

## What you'll set up (all free)

| Piece | Service | Free? |
|---|---|---|
| App hosting | Vercel (Hobby) | Free* |
| Database + Auth | Supabase (Free tier) | Free |
| Notifications | Slack Incoming Webhook | Free |

> **\*Heads-up on Vercel's free plan:** Vercel's Hobby tier is licensed for *personal, non-commercial* use only — an internal company tool maintained by employees technically falls outside that. It will work, but if you want to stay strictly within terms, either upgrade to Vercel Pro ($20/mo) or deploy the same code to **Cloudflare Pages**, whose free tier permits commercial use. The code is identical either way.

> **Supabase free-tier note:** projects pause after 7 days of no activity. A daily keep-alive cron (`/api/keepalive`, wired in `vercel.json`) prevents this automatically once deployed.

---

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**. Pick a name, a strong DB password, and a region near your team.
2. Once it's ready, open **SQL Editor → New query**, paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql), and **Run**. This creates all tables, security policies, and triggers.
3. Open **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (server-only — never expose this)

## 2. Enable Google sign-in

1. In **Google Cloud Console** ([console.cloud.google.com](https://console.cloud.google.com)) → create a project → **APIs & Services → Credentials → Create OAuth client ID → Web application**.
2. Under **Authorized redirect URIs** add the callback shown in Supabase: **Supabase → Authentication → Providers → Google** (it looks like `https://<your-project>.supabase.co/auth/v1/callback`).
3. Copy the Google **Client ID** and **Client secret** into Supabase's Google provider settings and toggle it **on**.
4. To restrict who can sign in, set `ALLOWED_EMAIL_DOMAINS` (below) to your work domain(s), e.g. `yourcompany.com`. Anyone signing in with another domain is rejected automatically. Leave blank to allow anyone.

## 3. Create the Slack webhook

1. [api.slack.com/apps](https://api.slack.com/apps) → **Create New App → From scratch** → pick your workspace.
2. **Incoming Webhooks → Activate → Add New Webhook to Workspace** → choose the channel for notifications.
3. Copy the webhook URL into `SLACK_WEBHOOK_URL`.

## 4. Run locally

```bash
cp .env.local.example .env.local   # then fill in the values from steps 1–3
npm install
npm run dev                         # http://localhost:3000
```

Add `http://localhost:3000/auth/callback` as an extra redirect URI in Google + add `http://localhost:3000` to Supabase **Authentication → URL Configuration → Site URL / Redirect URLs** for local testing.

## 5. Deploy to Vercel

1. Push this folder to a GitHub repo.
2. [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
3. Add all the environment variables from your `.env.local` in **Project → Settings → Environment Variables**. Add `CRON_SECRET` (any long random string) too.
4. Deploy. Then in **Supabase → Authentication → URL Configuration**, set your **Site URL** to the Vercel domain and add `https://<your-app>.vercel.app/auth/callback` to both the redirect URLs there and in Google Cloud's OAuth client.

The daily keep-alive cron runs automatically via `vercel.json`.

### Deploying to Cloudflare Pages instead
Use the same repo. In Cloudflare Pages choose the **Next.js** preset, add the same env vars, and replace the cron with a **Cloudflare Cron Trigger** hitting `/api/keepalive` (Vercel-specific `vercel.json` crons don't apply there).

---

## How the features map to the code

- **Task fields** (title, description, ETA, status, effort, priority, stakeholders, delivered date, assignee) — `app/components/task-form.tsx`, schema in `supabase/schema.sql`.
- **Stakeholder autocomplete from existing people** — `app/components/stakeholder-select.tsx`.
- **Kanban board** (arrows move status; live-updates via Supabase Realtime) — `app/components/kanban-board.tsx`.
- **Table view** with search + filters and **overdue** highlighting — `app/components/task-table.tsx`.
- **Per-person picked/closed reporting with date range** — `app/components/people-report.tsx`. Powered by `picked_date` (auto-set when a task first enters *Working*) and `delivered_date` (auto-set when *Completed*).
- **Auth + name/email display + domain restriction** — `lib/supabase/middleware.ts`, `app/login/page.tsx`, `app/(app)/layout.tsx`.
- **Light/dark mode** — `app/components/theme-provider.tsx` + `theme-toggle.tsx`, tokens in `app/globals.css`.
- **Slack on status change** — `lib/slack.ts`, fired from `app/(app)/actions.ts`.
- **Status history log** (audit trail) — `task_status_history` table, written by a DB trigger.

## Admin / roles
Everyone is a `member` by default and can create/edit/delete tasks (typical for a small internal team). To make someone an admin, run in Supabase SQL editor:
```sql
update public.profiles set role = 'admin' where email = 'someone@yourcompany.com';
```
The `role` column is ready if you later want to gate destructive actions to admins.

## Common gotchas
- **Login loops / "redirect URI mismatch"** → the callback URL isn't added in *both* Google Cloud and Supabase URL config.
- **Rejected at login** → the email domain isn't listed in `ALLOWED_EMAIL_DOMAINS`.
- **No Slack message** → check `SLACK_WEBHOOK_URL`; notifications only fire when the status actually changes.
- **Project paused** → the keep-alive cron hasn't run yet; visit the app once or trigger `/api/keepalive`.
