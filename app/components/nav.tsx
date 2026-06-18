"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";
import type { Profile } from "@/lib/types";

const BASE_LINKS = [
  { href: "/board", label: "Board" },
  { href: "/tasks", label: "Tasks" },
  { href: "/people", label: "People" },
];

export function Nav({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const links =
    profile.role === "admin"
      ? [...BASE_LINKS, { href: "/admin", label: "Admin" }]
      : BASE_LINKS;

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/board" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-xs font-bold text-white">
            PM
          </span>
          <span className="text-sm font-semibold tracking-tight">Instructor Team Task manager</span>
        </Link>

        <nav className="ml-2 flex items-center gap-1">
          {links.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-surface font-medium text-fg shadow-sm"
                    : "text-muted hover:text-fg"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />
          <div className="flex items-center gap-2">
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
            <div className="hidden text-right sm:block">
              <div className="text-xs font-medium leading-tight">{profile.full_name}</div>
              <div className="text-[11px] leading-tight text-muted">{profile.email}</div>
            </div>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted transition-colors hover:text-fg"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
