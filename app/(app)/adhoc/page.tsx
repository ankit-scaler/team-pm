import { getAdhocRequests, getPeople } from "@/lib/queries";
import { getMyAccess } from "@/lib/access";
import { DEFAULT_METRICS, PROGRAMS } from "@/lib/types";
import { AdhocList } from "../../components/adhoc-list";
import { AdhocForm } from "../../components/adhoc-form";

export const dynamic = "force-dynamic";

export default async function AdhocPage() {
  const [requests, people, access] = await Promise.all([
    getAdhocRequests(),
    getPeople(),
    getMyAccess(),
  ]);
  const allowedPrograms = access.isAdmin ? [...PROGRAMS] : access.visiblePrograms;
  const allMetrics = Array.from(
    new Set([...DEFAULT_METRICS, ...requests.flatMap((r) => r.metrics ?? [])])
  );

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
      <AdhocList requests={requests} people={people} />
    </div>
  );
}
