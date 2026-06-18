import { getPeople, getTasks } from "@/lib/queries";
import { KanbanBoard } from "../../components/kanban-board";
import { TaskForm } from "../../components/task-form";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const [tasks, people] = await Promise.all([getTasks(), getPeople()]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Board</h1>
          <p className="text-sm text-muted">Drag work across stages. Status changes notify Slack.</p>
        </div>
        <TaskForm people={people} />
      </div>
      <KanbanBoard tasks={tasks} people={people} />
    </div>
  );
}
