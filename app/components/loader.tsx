"use client";

import { useState } from "react";

export const LOADER_LINES = [
  "Always share ETA to keep stakeholders aligned…",
  "Let's get things done…",
  "Clearing the runway…",
  "Breathe in, breathe out.",
  "Time to crush those goals.",
];

export function Loader({ className = "" }: { className?: string }) {
  // Pick once per mount so it stays stable while visible.
  const [line] = useState(() => LOADER_LINES[Math.floor(Math.random() * LOADER_LINES.length)]);

  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-20 ${className}`}>
      <span
        className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-accent"
        aria-hidden="true"
      />
      <p className="text-xs font-bold tracking-wide text-muted">{line}</p>
    </div>
  );
}
