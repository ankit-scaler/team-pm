import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isCalendarConnected } from "@/lib/google";
import { getMyAccess } from "@/lib/access";
import { Nav } from "../components/nav";
import { Footer } from "../components/footer";
import type { Profile } from "@/lib/types";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url, role")
    .eq("id", user.id)
    .single();

  // Fallback if the profile row hasn't propagated yet.
  const safeProfile: Profile =
    (profile as Profile) ?? {
      id: user.id,
      email: user.email ?? "",
      full_name: user.user_metadata?.full_name ?? null,
      avatar_url: user.user_metadata?.avatar_url ?? null,
      role: "member",
    };

  const access = await getMyAccess();
  const calendarConnected = await isCalendarConnected(user.id);

  // Signed in but not assigned to any program yet — friendly lock screen.
  if (access.isPending) {
    return (
      <div className="grid min-h-screen place-items-center px-6">
        <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 text-center shadow-sm">
          <h1 className="text-lg font-bold tracking-tight">You&apos;re not in a program yet</h1>
          <p className="mt-2 text-sm text-muted">
            Signed in as <span className="font-medium text-fg">{safeProfile.email}</span>. Ask an admin
            or a module owner to add you to a program, then refresh.
          </p>
          <form action="/auth/signout" method="post" className="mt-5">
            <button
              type="submit"
              className="rounded-lg border border-border px-3 py-2 text-sm text-muted transition-colors hover:text-fg"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Nav
        profile={safeProfile}
        calendarConnected={calendarConnected}
        isAdmin={access.isAdmin}
        isManager={access.isAdmin || access.moPrograms.length > 0}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      <Footer />
    </div>
  );
}
