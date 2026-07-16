import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { consentUrl, googleConfigured } from "@/lib/google";

function appUrlFrom(request: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  return host ? `${proto}://${host}` : "";
}

// Kicks off the "Connect Google Calendar" OAuth flow for the signed-in user.
export async function GET(request: Request) {
  if (!googleConfigured()) {
    return NextResponse.json({ error: "Google not configured" }, { status: 501 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", appUrlFrom(request)));

  const state = randomUUID();
  const res = NextResponse.redirect(consentUrl(appUrlFrom(request), state));
  // CSRF guard: match this back in the callback.
  res.cookies.set("g_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
