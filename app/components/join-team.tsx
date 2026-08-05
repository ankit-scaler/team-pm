"use client";

import { useState, useTransition } from "react";
import { Check, Clock, Users, RefreshCw, Loader2 } from "lucide-react";
import { requestJoinTeam } from "../(app)/actions";
import type { JoinTeam as JoinTeamRow } from "@/lib/types";

export function JoinTeam({ teams: initial, email }: { teams: JoinTeamRow[]; email: string }) {
  const [teams, setTeams] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const hasPending = teams.some((t) => t.myStatus === "pending");

  function request(id: string) {
    setBusy(id);
    startTransition(async () => {
      try {
        await requestJoinTeam(id);
        setTeams((ts) =>
          ts.map((t) => (t.id === id && !t.myStatus ? { ...t, myStatus: "pending" } : t))
        );
      } catch {
        /* ignore — button re-enables */
      }
      setBusy(null);
    });
  }

  return (
    <div className="w-full max-w-xl">
      <h1 className="text-xl font-bold tracking-tight">Join a team to get started</h1>
      <p className="mt-1 text-sm text-muted">
        Signed in as <span className="font-medium text-fg">{email}</span>. Request to join one or more
        teams. A team leader or an admin will review and accept you — you&apos;ll get access to the app
        as soon as you&apos;re approved.
      </p>

      <div className="mt-5 space-y-2">
        {teams.length === 0 && (
          <p className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
            No teams have been created yet. Please ask an admin to set one up.
          </p>
        )}

        {teams.map((t) => {
          const joined = t.myStatus !== null;
          return (
            <div
              key={t.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"
            >
              <div className="min-w-0">
                <div className="font-semibold text-fg">{t.name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                  <span>Leader: {t.leaderName ?? "—"}</span>
                  <span className="inline-flex items-center gap-1">
                    <Users size={12} /> {t.memberCount} member{t.memberCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              {t.myStatus === "accepted" ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <Check size={13} /> Member
                </span>
              ) : t.myStatus === "pending" ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  <Clock size={13} /> Requested
                </span>
              ) : (
                <button
                  type="button"
                  disabled={busy === t.id}
                  onClick={() => request(t.id)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {busy === t.id && <Loader2 size={13} className="animate-spin" />} Request to join
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Waiting state — shown once at least one request is pending. */}
      {hasPending && (
        <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
            <Clock size={15} /> Waiting for approval
          </div>
          <p className="mt-1 text-xs leading-relaxed text-amber-700/90 dark:text-amber-300/90">
            Your request has been sent. A team leader (or an admin) needs to accept you before you can
            use the app — you&apos;ll be let in automatically once approved.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-xs font-semibold text-white"
          >
            <RefreshCw size={13} /> Check status
          </button>
        </div>
      )}

      <div className="mt-6">
        <form action="/auth/signout" method="post">
          <button type="submit" className="text-xs text-muted hover:text-fg">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
