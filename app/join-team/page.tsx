import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyAccess } from "@/lib/access";
import { getTeamsForJoin } from "@/lib/queries";
import { JoinTeam } from "../components/join-team";

export const dynamic = "force-dynamic";

// Onboarding gate screen — rendered OUTSIDE the (app) layout so it isn't itself
// subject to the team gate (which would loop). Admins and people already on a
// team are bounced to the board.
export default async function JoinTeamPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const access = await getMyAccess();
  // Admins and already-accepted members skip this screen; requested-but-pending
  // users stay here on the waiting state until a leader accepts them. A user with
  // no program yet is bounced to /board so they hit the program gate first.
  if (access.isAdmin || access.hasAcceptedTeam || access.isPending) redirect("/board");

  const teams = await getTeamsForJoin();

  return (
    <div className="grid min-h-screen place-items-center px-6 py-10">
      <JoinTeam teams={teams} email={user.email ?? ""} />
    </div>
  );
}
