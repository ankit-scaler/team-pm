import { getPeople, getTasks, distinctTags } from "@/lib/queries";
import { KanbanBoard } from "../../components/kanban-board";
import { TaskForm } from "../../components/task-form";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const [tasks, people] = await Promise.all([getTasks(), getPeople()]);
  const allTags = distinctTags(tasks);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Board</h1>
          <p className="text-sm text-muted">Move work across stages. New tasks and status changes notify Slack.</p>
        </div>
        <TaskForm people={people} allTags={allTags} />
      </div>
      <KanbanBoard tasks={tasks} people={people} allTags={allTags} />
    </div>
  );
}
