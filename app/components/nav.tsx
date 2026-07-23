"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CalendarCheck2, CalendarPlus } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import type { Profile } from "@/lib/types";

const BASE_LINKS = [
  { href: "/board", label: "Board" },
  { href: "/tasks", label: "Tasks" },
  { href: "/people", label: "People" },
  { href: "/krs", label: "KRs" },
  { href: "/adhoc", label: "Adhoc" },
];

export function Nav({
  profile,
  calendarConnected = false,
  isAdmin = false,
  isManager = false,
}: {
  profile: Profile;
  calendarConnected?: boolean;
  isAdmin?: boolean;
  isManager?: boolean;
}) {
  const pathname = usePathname();
  const [logoOk, setLogoOk] = useState(true);
  const links = [
    ...BASE_LINKS,
    ...(isManager ? [{ href: "/admin", label: "Access" }] : []),
    ...(isAdmin
      ? [
          { href: "/insights", label: "Insights" },
          { href: "/summary", label: "Summary" },
          { href: "/activity", label: "Activity" },
          { href: "/lists", label: "Lists" },
        ]
      : []),
  ];

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/80 backdrop-blur">
      <div className="flex h-14 items-center gap-4 px-4 sm:px-6">
        <Link href="/board" className="flex items-center gap-2">
          {logoOk ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/scaler-logo.svg"
              alt="Scaler"
              className="h-6 w-auto dark:brightness-0 dark:invert"
              onError={() => setLogoOk(false)}
            />
          ) : (
            <span className="text-base font-extrabold tracking-tight text-accent">Scaler</span>
          )}
          <span className="hidden text-sm font-semibold tracking-tight text-muted sm:inline">
            .
          </span>
        </Link>

        <nav className="ml-2 flex shrink-0 items-center gap-0.5">
          {links.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "font-semibold text-fg"
                    : "font-medium text-muted hover:bg-surface-2 hover:text-fg"
                }`}
              >
                {l.label}
                {active && (
                  <span className="absolute inset-x-2.5 -bottom-[15px] h-0.5 rounded-full bg-accent" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2.5">
          {calendarConnected ? (
            <span
              className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-emerald-500/40 px-2.5 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 xl:inline-flex"
              title="Your Google Calendar is connected — new tasks with an ETA will block your stakeholders' calendars."
            >
              <CalendarCheck2 size={14} /> Calendar connected
            </span>
          ) : (
            <a
              href="/api/google/connect"
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:text-fg hover:bg-surface-2"
              title="Connect your Google Calendar so tasks you create with an ETA block your stakeholders' calendars."
            >
              <CalendarPlus size={14} /> <span className="hidden lg:inline">Connect Calendar</span>
            </a>
          )}
          <ThemeToggle />
          <div className="flex shrink-0 items-center gap-2">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt=""
                className="h-7 w-7 rounded-full border border-border"
              />
            ) : (
              <span className="grid h-7 w-7 place-items-center rounded-full bg-accent/15 text-xs font-medium text-accent">
                {(profile.full_name ?? profile.email)[0]?.toUpperCase()}
              </span>
            )}
            <div className="hidden max-w-[150px] text-right xl:block">
              <div className="truncate text-xs font-medium leading-tight">{profile.full_name}</div>
              <div className="truncate text-[11px] leading-tight text-muted">{profile.email}</div>
            </div>
          </div>
          <form action="/auth/signout" method="post" className="shrink-0">
            <button
              type="submit"
              className="whitespace-nowrap rounded-md border border-border px-2.5 py-1.5 text-xs text-muted transition-colors hover:text-fg"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
