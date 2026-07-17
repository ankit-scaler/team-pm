import { createAdminClient } from "@/lib/supabase/server";

// -----------------------------------------------------------------------------
//  Google Calendar integration (Task 1)
//  Raw REST — no SDK. A task creator connects their Google Calendar once; when a
//  task has an ETA we create ONE all-day event spanning today -> ETA on their
//  primary calendar, with @scaler.com stakeholders added as attendees (Google
//  then invites them / auto-adds it via Workspace defaults).
//
//  All calendar calls are fire-and-forget: they must never break task CRUD.
// -----------------------------------------------------------------------------

const OAUTH_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

function clientId() {
  return process.env.GOOGLE_CLIENT_ID ?? "";
}
function clientSecret() {
  return process.env.GOOGLE_CLIENT_SECRET ?? "";
}

export function googleConfigured(): boolean {
  return Boolean(clientId() && clientSecret());
}

export function redirectUri(appUrl: string): string {
  return `${appUrl.replace(/\/$/, "")}/api/google/callback`;
}

// Build the consent-screen URL. access_type=offline + prompt=consent so we get a
// refresh token we can use later (from server actions, cron, etc.).
export function consentUrl(appUrl: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(appUrl),
    response_type: "code",
    scope: OAUTH_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Exchange the one-time auth code for tokens (contains the refresh_token).
export async function exchangeCode(
  code: string,
  appUrl: string
): Promise<{ refresh_token?: string; access_token?: string } | null> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri(appUrl),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    console.error("Google token exchange failed:", await res.text());
    return null;
  }
  return res.json();
}

// Trade a stored refresh token for a fresh short-lived access token.
async function accessTokenFor(refreshToken: string): Promise<string | null> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId(),
      client_secret: clientSecret(),
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    console.error("Google token refresh failed:", await res.text());
    return null;
  }
  const json = await res.json();
  return json.access_token ?? null;
}

export async function saveCredentials(profileId: string, refreshToken: string, email: string | null) {
  const admin = createAdminClient();
  await admin.from("google_credentials").upsert(
    { profile_id: profileId, refresh_token: refreshToken, email, updated_at: new Date().toISOString() },
    { onConflict: "profile_id" }
  );
}

export async function isCalendarConnected(profileId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("google_credentials")
    .select("profile_id")
    .eq("profile_id", profileId)
    .maybeSingle();
  return Boolean(data);
}

async function refreshTokenFor(profileId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("google_credentials")
    .select("refresh_token")
    .eq("profile_id", profileId)
    .maybeSingle();
  return data?.refresh_token ?? null;
}

// All-day events use exclusive end dates, so end = ETA + 1 day.
function nextDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

type SyncArgs = {
  taskId: string;
  creatorId: string | null;
  title: string;
  eta: string | null; // yyyy-mm-dd
  existingEventId: string | null;
  stakeholderEmails: string[];
};

// Create / update / delete the calendar block for a task. Returns the event id
// to persist on the task (or null if there is no event). Never throws.
export async function syncTaskCalendarEvent(args: SyncArgs): Promise<string | null> {
  try {
    if (!googleConfigured() || !args.creatorId) return args.existingEventId;

    const refresh = await refreshTokenFor(args.creatorId);
    if (!refresh) return args.existingEventId; // creator hasn't connected — no-op

    const token = await accessTokenFor(refresh);
    if (!token) return args.existingEventId;

    // No ETA anymore -> remove any existing block.
    if (!args.eta) {
      if (args.existingEventId) await deleteEvent(token, args.existingEventId);
      return null;
    }

    const attendees = args.stakeholderEmails
      .filter((e) => e && e.toLowerCase().endsWith("@scaler.com"))
      .map((email) => ({ email }));

    const body = {
      summary: `🛠️ Working: ${args.title}`,
      description: "Auto-created by Team PM — reserved until this task's ETA.",
      start: { date: todayIso() },
      end: { date: nextDay(args.eta) },
      attendees,
      transparency: "opaque", // shows as Busy
      reminders: { useDefault: false },
    };

    const authHeaders = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    if (args.existingEventId) {
      const res = await fetch(
        `${CAL_BASE}/${encodeURIComponent(args.existingEventId)}?sendUpdates=all`,
        { method: "PATCH", headers: authHeaders, body: JSON.stringify(body) }
      );
      if (res.ok) return args.existingEventId;
      // Only re-create if the event is genuinely gone. On a transient error
      // (429/500/403) keep the existing id — otherwise we'd orphan the old event
      // and create a duplicate that double-books attendees.
      if (res.status !== 404 && res.status !== 410) {
        console.error("Google Calendar update failed:", res.status, await res.text());
        return args.existingEventId;
      }
      // 404/410 → event was deleted on Google's side; fall through to create.
    }

    const res = await fetch(`${CAL_BASE}?sendUpdates=all`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error("Google Calendar create failed:", await res.text());
      return args.existingEventId;
    }
    const json = await res.json();
    return json.id ?? args.existingEventId;
  } catch (e) {
    console.error("syncTaskCalendarEvent error:", e);
    return args.existingEventId;
  }
}

export async function deleteTaskCalendarEvent(creatorId: string | null, eventId: string | null) {
  try {
    if (!googleConfigured() || !creatorId || !eventId) return;
    const refresh = await refreshTokenFor(creatorId);
    if (!refresh) return;
    const token = await accessTokenFor(refresh);
    if (!token) return;
    await deleteEvent(token, eventId);
  } catch (e) {
    console.error("deleteTaskCalendarEvent error:", e);
  }
}

async function deleteEvent(accessToken: string, eventId: string) {
  await fetch(`${CAL_BASE}/${encodeURIComponent(eventId)}?sendUpdates=all`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
