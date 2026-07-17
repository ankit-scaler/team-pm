import { getPeople, getTasks, distinctTags, distinctMetrics } from "@/lib/queries";
import { TaskTable } from "../../components/task-table";
import { TaskForm } from "../../components/task-form";
import { AdhocForm } from "../../components/adhoc-form";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const [tasks, people] = await Promise.all([getTasks(), getPeople()]);
  const allTags = distinctTags(tasks);
  const allMetrics = distinctMetrics(tasks);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted">{tasks.length} tasks · filter by stage, person, tag, or ETA.</p>
        </div>
        <div className="flex items-center gap-2">
          <AdhocForm variant="outline" people={people} />
          <TaskForm people={people} allTags={allTags} allMetrics={allMetrics} />
        </div>
      </div>
      <TaskTable tasks={tasks} people={people} allTags={allTags} allMetrics={allMetrics} />
    </div>
  );
}
