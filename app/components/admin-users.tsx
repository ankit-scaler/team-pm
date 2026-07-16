"use client";

import { useMemo, useState, useTransition } from "react";
import { Trash2, X } from "lucide-react";
import {
  deleteUser,
  setUserRole,
  setMembership,
  removeMembership,
} from "../(app)/actions";
import type { Profile } from "@/lib/types";
import type { MembershipRow } from "@/lib/queries";

export function AdminUsers({
  users,
  memberships,
  currentUserId,
  isAdmin,
  managePrograms,
}: {
  users: Profile[];
  memberships: MembershipRow[];
  currentUserId: string;
  isAdmin: boolean;
  managePrograms: string[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const byProfile = useMemo(() => {
    const m: Record<string, MembershipRow[]> = {};
    for (const row of memberships) (m[row.profile_id] ??= []).push(row);
    return m;
  }, [memberships]);

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  // A manager only sees/edits memberships within the programs they manage.
  const scoped = (rows: MembershipRow[]) =>
    isAdmin ? rows : rows.filter((r) => managePrograms.includes(r.program));

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">User</th>
              <th className="px-4 py-2.5 font-medium">Programs &amp; access</th>
              {isAdmin && <th className="px-4 py-2.5 text-right font-medium">Admin</th>}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === currentUserId;
              const isAdminUser = u.role === "admin";
              const rows = scoped(byProfile[u.id] ?? []);
              const taken = new Set(rows.map((r) => r.program));
              const available = managePrograms.filter((p) => !taken.has(p));
              return (
                <tr key={u.id} className="border-b border-border align-top last:border-0 hover:bg-bg/60">
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
                    {isAdminUser ? (
                      <span className="inline-flex items-center rounded-md border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                        Admin · all programs
                      </span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {rows.length === 0 && <span className="text-xs text-muted">No programs</span>}
                        {rows.map((r) => (
                          <span
                            key={r.program}
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-fg/80"
                          >
                            {r.program} · {r.role}
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => run(() => removeMembership(u.id, r.program))}
                              className="text-muted hover:text-red-600 disabled:opacity-50"
                              aria-label={`Remove ${r.program}`}
                            >
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                        {available.length > 0 && (
                          <AddMembership
                            programs={available}
                            allowMO={isAdmin}
                            disabled={pending}
                            onAdd={(program, role) => run(() => setMembership(u.id, program, role))}
                          />
                        )}
                      </div>
                    )}
                  </td>

                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={isSelf || pending}
                          onClick={() =>
                            run(() => setUserRole(u.id, isAdminUser ? "member" : "admin"))
                          }
                          className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted transition-colors hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
                          title={isSelf ? "You can't change your own admin access" : ""}
                        >
                          {isAdminUser ? "Revoke admin" : "Make admin"}
                        </button>
                        <button
                          type="button"
                          disabled={isSelf || pending}
                          onClick={() => {
                            if (
                              confirm(
                                `Remove ${u.full_name ?? u.email}? They lose access immediately; their tasks stay but become unassigned.`
                              )
                            )
                              run(() => deleteUser(u.id));
                          }}
                          title={isSelf ? "You can't remove yourself" : "Remove user"}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-950/40"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        {isAdmin
          ? "Admins see everything. Assign people as MO or User of specific programs; MOs can add Users to their own programs."
          : "You can add or remove Users in the program(s) you own."}
      </p>
    </div>
  );
}

function AddMembership({
  programs,
  allowMO,
  disabled,
  onAdd,
}: {
  programs: string[];
  allowMO: boolean;
  disabled: boolean;
  onAdd: (program: string, role: "mo" | "user") => void;
}) {
  const [program, setProgram] = useState("");
  const [role, setRole] = useState<"mo" | "user">("user");
  const cls = "rounded-md border border-border bg-surface px-1.5 py-1 text-[11px] outline-none";
  return (
    <span className="inline-flex items-center gap-1">
      <select value={program} onChange={(e) => setProgram(e.target.value)} className={cls}>
        <option value="">+ program…</option>
        {programs.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      {allowMO && (
        <select value={role} onChange={(e) => setRole(e.target.value as "mo" | "user")} className={cls}>
          <option value="user">User</option>
          <option value="mo">MO</option>
        </select>
      )}
      <button
        type="button"
        disabled={!program || disabled}
        onClick={() => {
          onAdd(program, role);
          setProgram("");
          setRole("user");
        }}
        className="rounded-md bg-accent px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
      >
        Add
      </button>
    </span>
  );
}
