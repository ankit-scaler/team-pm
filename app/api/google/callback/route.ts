import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCode, saveCredentials } from "@/lib/google";

function appUrlFrom(request: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  return host ? `${proto}://${host}` : "";
}

// Google redirects back here with ?code=... after the user consents.
export async function GET(request: Request) {
  const appUrl = appUrlFrom(request);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)g_oauth_state=([^;]+)/)?.[1];

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/board?calendar=error&reason=${reason}`, appUrl));

  if (!code) return fail("no_code");
  if (!state || !cookieState || state !== cookieState) return fail("bad_state");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", appUrl));

  const tokens = await exchangeCode(code, appUrl);
  if (!tokens?.refresh_token) return fail("no_refresh_token");

  await saveCredentials(user.id, tokens.refresh_token, user.email ?? null);

  const res = NextResponse.redirect(new URL("/board?calendar=connected", appUrl));
  res.cookies.set("g_oauth_state", "", { maxAge: 0, path: "/" });
  return res;
}
