"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteAdhocRequest } from "../(app)/actions";

// Delete control for an adhoc request. Used on the Adhoc list and the Board card.
export function AdhocDeleteButton({ id, className }: { id: string; className?: string }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!confirm("Delete this adhoc request? This can't be undone.")) return;
    startTransition(async () => {
      try {
        await deleteAdhocRequest(id);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Could not delete this adhoc request.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label="Delete adhoc request"
      className={
        className ??
        "grid h-8 w-8 place-items-center rounded-md text-muted transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-400"
      }
    >
      <Trash2 size={15} />
    </button>
  );
}
