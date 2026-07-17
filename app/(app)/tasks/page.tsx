import { getPeople, getTasks, distinctTags, distinctMetrics } from "@/lib/queries";
import { getMyAccess } from "@/lib/access";
import { PROGRAMS } from "@/lib/types";
import { TaskTable } from "../../components/task-table";
import { TaskForm } from "../../components/task-form";
import { AdhocForm } from "../../components/adhoc-form";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const [tasks, people, access] = await Promise.all([getTasks(), getPeople(), getMyAccess()]);
  const allTags = distinctTags(tasks);
  const allMetrics = distinctMetrics(tasks);
  const allowedPrograms = access.isAdmin ? [...PROGRAMS] : access.visiblePrograms;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted">{tasks.length} tasks · filter by stage, person, tag, or ETA.</p>
        </div>
        <div className="flex items-center gap-2">
          <AdhocForm variant="outline" people={people} allowedPrograms={allowedPrograms} allMetrics={allMetrics} canCreateMetrics={access.isAdmin} />
          <TaskForm people={people} allTags={allTags} allMetrics={allMetrics} allowedPrograms={allowedPrograms} canCreateMetrics={access.isAdmin} />
        </div>
      </div>
      <TaskTable tasks={tasks} people={people} allTags={allTags} allMetrics={allMetrics} />
    </div>
  );
}
