import { getPeople, getTasks, distinctTags, getMetricNames } from "@/lib/queries";
import { ProgramTrackView } from "../../components/program-track-view";

export const dynamic = "force-dynamic";

export default async function ProgramTrackPage() {
  const [tasks, people, allMetrics] = await Promise.all([
    getTasks(),
    getPeople(),
    getMetricNames(),
  ]);
  const allTags = distinctTags(tasks);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Program · Track</h1>
        <p className="text-sm text-muted">
          Filter all tasks by program and track. Add a date range to narrow further.
        </p>
      </div>
      <ProgramTrackView tasks={tasks} people={people} allTags={allTags} allMetrics={allMetrics} />
    </div>
  );
}
