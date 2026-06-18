"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteUser, setUserRole } from "../(app)/actions";
import type { Profile } from "@/lib/types";

export function AdminUsers({
  users,
  currentUserId,
}: {
  users: Profile[];
  currentUserId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function changeRole(id: string, role: "member" | "admin") {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      try {
        await setUserRole(id, role);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update role");
      } finally {
        setBusyId(null);
      }
    });
  }

  function remove(u: Profile) {
    if (
      !confirm(
        `Remove ${u.full_name ?? u.email}? They'll lose access immediately. Their tasks stay but become unassigned. This can't be undone.`
      )
    )
      return;
    setError(null);
    setBusyId(u.id);
    startTransition(async () => {
      try {
        await deleteUser(u.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to remove user");
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">User</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-bg/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {u.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.avatar_url} alt="" className="h-7 w-7 rounded-full border border-border" />
                      ) : (
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-accent/15 text-[11px] font-medium text-accent">
                          {(u.full_name ?? u.email)[0]?.toUpperCase()}
                        </span>
                      )}
                      <div>
                        <div className="font-medium leading-tight">
                          {u.full_name ?? "—"} {isSelf && <span className="text-xs text-muted">(you)</span>}
                        </div>
                        <div className="text-xs leading-tight text-muted">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      disabled={pending && busyId === u.id}
                      onChange={(e) => changeRole(u.id, e.target.value as "member" | "admin")}
                      className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm outline-none disabled:opacity-50"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => remove(u)}
                      disabled={isSelf || (pending && busyId === u.id)}
                      title={isSelf ? "You can't remove yourself" : "Remove user"}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-950/40"
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        Removing a user deletes their login and profile. Tasks they created or were assigned stay in the
        system but show as unassigned. You can't remove or demote your own account here.
      </p>
    </div>
  );
}
