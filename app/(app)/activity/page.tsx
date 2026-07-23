import { redirect } from "next/navigation";
import { getMyAccess } from "@/lib/access";
import { getActivityLog } from "@/lib/queries";
import { ActivityView } from "../../components/activity-view";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const access = await getMyAccess();
  if (!access.isAdmin) redirect("/board");

  const entries = await getActivityLog();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Activity Log</h1>
        <p className="text-sm text-muted">
          Everything created, edited, moved, or deleted across the app. Filter by person, action,
          type, or date.
        </p>
      </div>
      <ActivityView entries={entries} />
    </div>
  );
}
