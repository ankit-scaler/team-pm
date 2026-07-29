import { getMyAccess } from "@/lib/access";
import { getImpactRows, getImpactStatuses } from "@/lib/queries";
import { ImpactTable } from "../../components/impact-table";

export const dynamic = "force-dynamic";

export default async function ImpactPage() {
  const [access, rows, statusOptions] = await Promise.all([
    getMyAccess(),
    getImpactRows(),
    getImpactStatuses(),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Metrics Impact</h1>
        <p className="text-sm text-muted">
          Before → after impact for each metric on completed tasks. Admins and module owners can edit;
          click the ⓘ next to a value to read its note.
        </p>
      </div>
      <ImpactTable
        rows={rows}
        statusOptions={statusOptions}
        isAdmin={access.isAdmin}
        moPrograms={access.moPrograms}
      />
    </div>
  );
}
