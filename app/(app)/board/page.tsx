import {
  getPeople,
  getTasks,
  getAdhocRequests,
  distinctTags,
  getMetricNames,
  getPrograms,
  getTracks,
  getTags,
  getEfforts,
  getPriorities,
} from "@/lib/queries";
import { getMyAccess } from "@/lib/access";
import { KanbanBoard } from "../../components/kanban-board";
import { TaskForm } from "../../components/task-form";
import { AdhocForm } from "../../components/adhoc-form";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const [tasks, people, adhocRequests, access, allMetrics, allPrograms, tracks, tagList, efforts, priorities] =
    await Promise.all([
      getTasks(),
      getPeople(),
      getAdhocRequests(),
      getMyAccess(),
      getMetricNames(),
      getPrograms(),
      getTracks(),
      getTags(),
      getEfforts(),
      getPriorities(),
    ]);
  const allTags = Array.from(new Set([...tagList, ...distinctTags(tasks)]));
  const allowedPrograms = access.isAdmin ? allPrograms : access.visiblePrograms;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Board</h1>
          <p className="text-sm text-muted">Move work across stages. New tasks and status changes notify Slack.</p>
        </div>
        <div className="flex items-center gap-2">
          <AdhocForm variant="outline" people={people} allowedPrograms={allowedPrograms} allMetrics={allMetrics} canCreateMetrics={access.isAdmin} />
          <TaskForm people={people} allTags={allTags} allMetrics={allMetrics} allowedPrograms={allowedPrograms} tracks={tracks} efforts={efforts} priorities={priorities} canCreateMetrics={access.isAdmin} />
        </div>
      </div>
      <KanbanBoard
        tasks={tasks}
        people={people}
        adhocRequests={adhocRequests}
        allTags={allTags}
        allMetrics={allMetrics}
        allPrograms={allowedPrograms}
        tracks={tracks}
        efforts={efforts}
        priorities={priorities}
        canCreateMetrics={access.isAdmin}
        userId={access.userId}
        isAdmin={access.isAdmin}
        moPrograms={access.moPrograms}
      />
    </div>
  );
}
