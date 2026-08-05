"use client";

import { useState, useTransition } from "react";
import { Check, X, Trash2, Plus, Crown, Clock, Pencil } from "lucide-react";
import {
  createTeam,
  renameTeam,
  deleteTeam,
  setTeamLeader,
  acceptMember,
  removeMember,
} from "../(app)/actions";
import type { ManageTeam, Profile } from "@/lib/types";

export function TeamsAdmin({
  teams,
  people,
  isAdmin,
}: {
  teams: ManageTeam[];
  people: Profile[];
  isAdmin: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {isAdmin && <CreateTeam people={people} disabled={pending} run={run} />}

      {teams.length === 0 && (
        <p className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
          {isAdmin ? "No teams yet — create one above." : "You don't lead any teams yet."}
        </p>
      )}

      <div className="space-y-3">
        {teams.map((t) => (
          <TeamCard key={t.id} team={t} people={people} isAdmin={isAdmin} disabled={pending} run={run} />
        ))}
      </div>
    </div>
  );
}

function CreateTeam({
  people,
  disabled,
  run,
}: {
  people: Profile[];
  disabled: boolean;
  run: (fn: () => Promise<void>) => void;
}) {
  const [name, setName] = useState("");
  const [leader, setLeader] = useState("");
  const cls = "rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent";
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-2/40 p-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New team name…"
        className={`${cls} min-w-[180px] flex-1`}
      />
      <select value={leader} onChange={(e) => setLeader(e.target.value)} className={cls}>
        <option value="">Choose leader…</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.full_name ?? p.email}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!name.trim() || !leader || disabled}
        onClick={() =>
          run(async () => {
            await createTeam(name.trim(), leader);
            setName("");
            setLeader("");
          })
        }
        className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-40"
      >
        <Plus size={16} /> Create team
      </button>
    </div>
  );
}

function TeamCard({
  team,
  people,
  isAdmin,
  disabled,
  run,
}: {
  team: ManageTeam;
  people: Profile[];
  isAdmin: boolean;
  disabled: boolean;
  run: (fn: () => Promise<void>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(team.name);

  const pendingReqs = team.members.filter((m) => m.status === "pending");
  const accepted = team.members.filter((m) => m.status === "accepted");

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {editing ? (
            <div className="flex items-center gap-1.5">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-md border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-accent"
                autoFocus
              />
              <button
                type="button"
                disabled={disabled || !name.trim()}
                onClick={() => run(async () => { await renameTeam(team.id, name.trim()); setEditing(false); })}
                className="rounded-md bg-accent px-2 py-1 text-xs font-semibold text-white disabled:opacity-40"
              >
                Save
              </button>
              <button type="button" onClick={() => { setName(team.name); setEditing(false); }} className="text-xs text-muted hover:text-fg">
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-fg">{team.name}</h3>
              {isAdmin && (
                <button type="button" onClick={() => setEditing(true)} className="text-muted hover:text-fg" aria-label="Rename team">
                  <Pencil size={13} />
                </button>
              )}
            </div>
          )}
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
            <Crown size={12} className="text-amber-500" />
            Leader:
            {isAdmin ? (
              <select
                value={team.leaderId ?? ""}
                onChange={(e) => run(() => setTeamLeader(team.id, e.target.value))}
                disabled={disabled}
                className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-xs outline-none"
              >
                {people.map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>
                ))}
              </select>
            ) : (
              <span className="font-medium text-fg/80">{team.leaderName ?? "—"}</span>
            )}
            <span className="ml-1">· {accepted.length} member{accepted.length === 1 ? "" : "s"}</span>
          </div>
        </div>

        {isAdmin && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (confirm(`Delete team "${team.name}"? Members will be unassigned from it.`))
                run(() => deleteTeam(team.id));
            }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Pending requests */}
      {pendingReqs.length > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            <Clock size={12} /> Requests to review ({pendingReqs.length})
          </div>
          <div className="space-y-1.5">
            {pendingReqs.map((m) => (
              <div key={m.profileId} className="flex items-center justify-between gap-2 rounded-lg bg-surface-2/40 px-3 py-1.5">
                <span className="text-sm text-fg">{m.name}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => run(() => acceptMember(team.id, m.profileId))}
                    className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
                  >
                    <Check size={12} /> Accept
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => run(() => removeMember(team.id, m.profileId))}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted hover:text-fg disabled:opacity-40"
                  >
                    <X size={12} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members */}
      <div className="mt-3">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Members</div>
        {accepted.length === 0 ? (
          <p className="text-xs text-muted">No accepted members yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {accepted.map((m) => {
              const isLeader = m.profileId === team.leaderId;
              return (
                <span
                  key={m.profileId}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs text-fg/80"
                >
                  {isLeader && <Crown size={11} className="text-amber-500" />}
                  {m.name}
                  {!isLeader && (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => run(() => removeMember(team.id, m.profileId))}
                      className="text-muted hover:text-red-600 disabled:opacity-40"
                      aria-label={`Remove ${m.name}`}
                    >
                      <X size={11} />
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
