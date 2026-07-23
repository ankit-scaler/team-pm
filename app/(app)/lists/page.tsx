import { redirect } from "next/navigation";
import { getMyAccess } from "@/lib/access";
import {
  getPrograms,
  getTracks,
  getMetricNames,
  getTags,
  getEfforts,
  getPriorities,
} from "@/lib/queries";
import { RegistryAdmin } from "../../components/registry-admin";

export const dynamic = "force-dynamic";

export default async function ListsPage() {
  const access = await getMyAccess();
  if (!access.isAdmin) redirect("/board");

  const [programs, tracks, metrics, tags, efforts, priorities] = await Promise.all([
    getPrograms(),
    getTracks(),
    getMetricNames(),
    getTags(),
    getEfforts(),
    getPriorities(),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Lists &amp; taxonomy</h1>
        <p className="text-sm text-muted">
          Add options that appear in every task/adhoc picker and filter. Status is fixed
          (To&nbsp;pick / Working / In&nbsp;Review / Completed).
        </p>
      </div>
      <RegistryAdmin
        programs={programs}
        tracks={tracks}
        metrics={metrics}
        tags={tags}
        efforts={efforts}
        priorities={priorities}
      />
    </div>
  );
}
