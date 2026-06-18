import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPeople } from "@/lib/queries";
import { AdminUsers } from "../../components/admin-users";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // Non-admins don't belong here.
  if (me?.role !== "admin") redirect("/board");

  const people = await getPeople();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted">Manage who can access the workspace and who's an admin.</p>
      </div>
      <AdminUsers users={people} currentUserId={user.id} />
    </div>
  );
}
