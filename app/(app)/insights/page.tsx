import { redirect } from "next/navigation";
import { getMyAccess } from "@/lib/access";
import { getTasks, getAdhocRequests, getPrograms } from "@/lib/queries";
import { InsightsView } from "../../components/insights-view";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const access = await getMyAccess();
  if (!access.isAdmin) redirect("/board");

  // Admin's queries return all programs.
  const [tasks, adhoc, programs] = await Promise.all([getTasks(), getAdhocRequests(), getPrograms()]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Insights</h1>
        <p className="text-sm text-muted">People productivity — tasks and adhoc, program-wise.</p>
      </div>
      <InsightsView tasks={tasks} adhoc={adhoc} programs={programs} />
    </div>
  );
}
