import { getAdhocRequests } from "@/lib/queries";
import { AdhocList } from "../../components/adhoc-list";

export const dynamic = "force-dynamic";

export default async function AdhocPage() {
  const requests = await getAdhocRequests();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Adhoc Requests</h1>
        <p className="text-sm text-muted">
          Requests raised via the <span className="font-medium">Instructor-flow</span> workflow in{" "}
          <span className="font-medium">#instructor-adhoc-request-1</span>. Read-only.
        </p>
      </div>
      <AdhocList requests={requests} />
    </div>
  );
}
