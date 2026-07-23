import { getAdhocRequests, getPeople, getMetricNames, getPrograms } from "@/lib/queries";
import { getMyAccess } from "@/lib/access";
import { AdhocList } from "../../components/adhoc-list";
import { AdhocForm } from "../../components/adhoc-form";

export const dynamic = "force-dynamic";

export default async function AdhocPage() {
  const [requests, people, access, allMetrics, allPrograms] = await Promise.all([
    getAdhocRequests(),
    getPeople(),
    getMyAccess(),
    getMetricNames(),
    getPrograms(),
  ]);
  const allowedPrograms = access.isAdmin ? allPrograms : access.visiblePrograms;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Adhoc Requests</h1>
          <p className="text-sm text-muted">
            {requests.length} request{requests.length === 1 ? "" : "s"} · added here or fetched from{" "}
            <span className="font-medium">#instructor-adhoc-request-1</span>.
          </p>
        </div>
        <AdhocForm variant="solid" people={people} allowedPrograms={allowedPrograms} allMetrics={allMetrics} canCreateMetrics={access.isAdmin} />
      </div>
      <AdhocList requests={requests} people={people} programs={allPrograms} />
    </div>
  );
}
