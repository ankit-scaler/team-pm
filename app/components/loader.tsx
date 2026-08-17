"use client";

import { useState } from "react";
import { Plane } from "lucide-react";

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
    <div className={`flex flex-col items-center justify-center gap-4 py-20 ${className}`}>
      <div className="plane-runway" aria-hidden="true">
        <Plane className="plane text-accent" size={26} strokeWidth={2} />
      </div>
      <p className="text-xs font-semibold tracking-wide text-muted">{line}</p>
    </div>
  );
}
