import { getPeople, getTasks } from "@/lib/queries";
import { PeopleReport } from "../../components/people-report";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const [tasks, people] = await Promise.all([getTasks(), getPeople()]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">People</h1>
        <p className="text-sm text-muted">Who picked up and closed what, over any date range.</p>
      </div>
      <PeopleReport tasks={tasks} people={people} />
    </div>
  );
}
