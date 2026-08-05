import { redirect } from "next/navigation";
import { getMyAccess } from "@/lib/access";
import { getTeamsManage, getPeople } from "@/lib/queries";
import { TeamsAdmin } from "../../components/teams-admin";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const access = await getMyAccess();
  const isLeader = access.ledTeamIds.length > 0;
  // Admins manage all teams; leaders manage the ones they lead. Nobody else.
  if (!access.isAdmin && !isLeader) redirect("/board");

  const [teams, people] = await Promise.all([getTeamsManage(), getPeople()]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Teams</h1>
        <p className="text-sm text-muted">
          {access.isAdmin
            ? "Create teams, set a leader, and accept the people requesting to join."
            : "Accept or remove people requesting to join your team."}
        </p>
      </div>
      <TeamsAdmin teams={teams} people={people} isAdmin={access.isAdmin} />
    </div>
  );
}
