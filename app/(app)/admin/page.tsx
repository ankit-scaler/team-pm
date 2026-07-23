import { redirect } from "next/navigation";
import { getPeople, getAllMemberships, getPrograms } from "@/lib/queries";
import { getMyAccess } from "@/lib/access";
import { AdminUsers } from "../../components/admin-users";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const access = await getMyAccess();
  // Admins and MOs (module owners) can manage people; everyone else is redirected.
  if (!access.isAdmin && access.moPrograms.length === 0) redirect("/board");

  const [people, memberships, programs] = await Promise.all([
    getPeople(),
    getAllMemberships(),
    getPrograms(),
  ]);
  const managePrograms = access.isAdmin ? programs : access.moPrograms;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Access</h1>
        <p className="text-sm text-muted">
          {access.isAdmin
            ? "Manage admins, module owners, and program access."
            : "Add or remove users in your program(s)."}
        </p>
      </div>
      <AdminUsers
        users={people}
        memberships={memberships}
        currentUserId={access.userId ?? ""}
        isAdmin={access.isAdmin}
        managePrograms={managePrograms}
      />
    </div>
  );
}
