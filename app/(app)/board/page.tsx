import { getPeople, getTasks, getAdhocRequests, distinctTags, distinctMetrics } from "@/lib/queries";
import { getMyAccess } from "@/lib/access";
import { PROGRAMS } from "@/lib/types";
import { KanbanBoard } from "../../components/kanban-board";
import { TaskForm } from "../../components/task-form";
import { AdhocForm } from "../../components/adhoc-form";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const [tasks, people, adhocRequests, access] = await Promise.all([
    getTasks(),
    getPeople(),
    getAdhocRequests(),
    getMyAccess(),
  ]);
  const allTags = distinctTags(tasks);
  const allMetrics = Array.from(
    new Set([...distinctMetrics(tasks), ...adhocRequests.flatMap((a) => a.metrics ?? [])])
  );
  const allowedPrograms = access.isAdmin ? [...PROGRAMS] : access.visiblePrograms;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Board</h1>
          <p className="text-sm text-muted">Move work across stages. New tasks and status changes notify Slack.</p>
        </div>
        <div className="flex items-center gap-2">
          <AdhocForm variant="outline" people={people} allowedPrograms={allowedPrograms} allMetrics={allMetrics} canCreateMetrics={access.isAdmin} />
          <TaskForm people={people} allTags={allTags} allMetrics={allMetrics} allowedPrograms={allowedPrograms} canCreateMetrics={access.isAdmin} />
        </div>
      </div>
      <KanbanBoard
        tasks={tasks}
        people={people}
        adhocRequests={adhocRequests}
        allTags={allTags}
        allMetrics={allMetrics}
      />
    </div>
  );
}
