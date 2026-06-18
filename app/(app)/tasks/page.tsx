import { getPeople, getTasks } from "@/lib/queries";
import { TaskTable } from "../../components/task-table";
import { TaskForm } from "../../components/task-form";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const [tasks, people] = await Promise.all([getTasks(), getPeople()]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted">{tasks.length} tasks · filter and sort the full list.</p>
        </div>
        <TaskForm people={people} />
      </div>
      <TaskTable tasks={tasks} people={people} />
    </div>
  );
}
