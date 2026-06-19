import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  return (
    <div className="flex min-h-screen flex-col">
      <Nav profile={safeProfile} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      <Footer />
    </div>
  );
}
