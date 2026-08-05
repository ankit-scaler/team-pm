import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth"];

function emailAllowed(email: string | undefined): boolean {
  if (!email) return false;
  const domains = (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  if (domains.length === 0) return true; // no restriction configured
  const domain = email.split("@")[1]?.toLowerCase();
  return domain ? domains.includes(domain) : false;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  // Signed in but with a disallowed email domain — sign out, bounce to login with reason.
  if (user && !emailAllowed(user.email)) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "domain");
    return NextResponse.redirect(url);
  }

  // Not signed in and trying to reach a protected page -> login.
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Team gate — enforced here (not only in the (app) layout) so it applies to
  // client-side navigations too: someone removed from all their teams is bounced
  // to the join screen on their very next request, not just a full reload.
  // Program-first is preserved: a user with no program is NOT redirected here —
  // they fall through to the layout's "not in a program yet" screen (this also
  // avoids a /board ⇄ /join-team redirect loop).
  if (user && !isPublic && !path.startsWith("/join-team")) {
    const [roleRes, progRes, acceptedRes, teamsRes] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).single(),
      supabase.from("program_memberships").select("*", { count: "exact", head: true }).eq("profile_id", user.id),
      // A leader is always an accepted member, so this covers leaders too.
      supabase.from("team_members").select("*", { count: "exact", head: true }).eq("profile_id", user.id).eq("status", "accepted"),
      supabase.from("teams").select("*", { count: "exact", head: true }),
    ]);
    const isAdmin = roleRes.data?.role === "admin";
    const hasProgram = (progRes.count ?? 0) > 0;
    const hasAcceptedTeam = (acceptedRes.count ?? 0) > 0;
    const teamsExist = (teamsRes.count ?? 0) > 0;

    if (!isAdmin && hasProgram && !hasAcceptedTeam && teamsExist) {
      const url = request.nextUrl.clone();
      url.pathname = "/join-team";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
