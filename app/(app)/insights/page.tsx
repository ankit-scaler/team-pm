import { redirect } from "next/navigation";
import { getMyAccess } from "@/lib/access";
import { getTasks } from "@/lib/queries";
import { InsightsView } from "../../components/insights-view";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const access = await getMyAccess();
  if (!access.isAdmin) redirect("/board");

  // Admin's getTasks returns all programs' tasks.
  const tasks = await getTasks();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Insights</h1>
        <p className="text-sm text-muted">People productivity — picked, completed, and timeliness, program-wise.</p>
      </div>
      <InsightsView tasks={tasks} />
    </div>
  );
}
