"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteKR } from "../(app)/actions";

export function KRDeleteButton({ id, code }: { id: string; code: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Delete ${code}? This removes it for everyone.`)) return;
        startTransition(async () => {
          try {
            await deleteKR(id);
            router.refresh();
          } catch (err) {
            alert(err instanceof Error ? err.message : "Could not delete this KR.");
          }
        });
      }}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-400"
      aria-label={`Delete ${code}`}
      title={`Delete ${code}`}
    >
      <Trash2 size={15} />
    </button>
  );
}
