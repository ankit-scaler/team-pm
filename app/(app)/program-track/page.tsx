import { getPeople, getTasks, distinctTags, distinctMetrics } from "@/lib/queries";
import { ProgramTrackView } from "../../components/program-track-view";

export const dynamic = "force-dynamic";

export default async function ProgramTrackPage() {
  const [tasks, people] = await Promise.all([getTasks(), getPeople()]);
  const allTags = distinctTags(tasks);
  const allMetrics = distinctMetrics(tasks);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Program · Track</h1>
        <p className="text-sm text-muted">
          Filter all tasks by program and track. Add a date range to narrow further.
        </p>
      </div>
      <ProgramTrackView tasks={tasks} people={people} allTags={allTags} allMetrics={allMetrics} />
    </div>
  );
}
