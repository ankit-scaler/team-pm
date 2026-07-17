import { redirect } from "next/navigation";
import { getMyAccess } from "@/lib/access";
import { getTasks, getAdhocRequests } from "@/lib/queries";
import { SummaryView } from "../../components/summary-view";

export const dynamic = "force-dynamic";

export default async function SummaryPage() {
  const access = await getMyAccess();
  if (!access.isAdmin) redirect("/board");

  // Admin's queries return all programs; the view filters by the chosen one.
  const [tasks, adhoc] = await Promise.all([getTasks(), getAdhocRequests()]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Program Summary</h1>
        <p className="text-sm text-muted">
          Pick a program to see who worked on it (assignee or stakeholder), the tasks/adhoc they
          touched, and how many times each metric came up.
        </p>
      </div>
      <SummaryView tasks={tasks} adhoc={adhoc} />
    </div>
  );
}
