import {
  getPeople,
  getTasks,
  distinctTags,
  getMetricNames,
  getPrograms,
  getTracks,
  getTags,
  getEfforts,
  getPriorities,
} from "@/lib/queries";
import { getMyAccess } from "@/lib/access";
import { TaskTable } from "../../components/task-table";
import { TaskForm } from "../../components/task-form";
import { AdhocForm } from "../../components/adhoc-form";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const [tasks, people, access, allMetrics, allPrograms, tracks, tagList, efforts, priorities] =
    await Promise.all([
      getTasks(),
      getPeople(),
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
          <h1 className="text-xl font-bold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted">{tasks.length} tasks · filter by stage, person, tag, or ETA.</p>
        </div>
        <div className="flex items-center gap-2">
          <AdhocForm variant="outline" people={people} allowedPrograms={allowedPrograms} allMetrics={allMetrics} canCreateMetrics={access.isAdmin} />
          <TaskForm people={people} allTags={allTags} allMetrics={allMetrics} allowedPrograms={allowedPrograms} tracks={tracks} efforts={efforts} priorities={priorities} canCreateMetrics={access.isAdmin} />
        </div>
      </div>
      <TaskTable tasks={tasks} people={people} allTags={allTags} allMetrics={allMetrics} programs={allPrograms} tracks={tracks} priorities={priorities} efforts={efforts} allowedPrograms={allowedPrograms} canCreateMetrics={access.isAdmin} />
    </div>
  );
}
