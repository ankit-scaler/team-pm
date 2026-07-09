import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Run on everything except static assets, images, and API routes.
    // API routes (e.g. /api/keepalive) manage their own auth — via CRON_SECRET —
    // and must never be redirected to /login, since callers like curl or Vercel's
    // cron have no browser session/cookies.
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
