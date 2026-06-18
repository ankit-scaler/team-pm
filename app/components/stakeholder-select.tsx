"use client";

import { useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Profile } from "@/lib/types";

// Autocomplete multi-select. Emits hidden <input name="stakeholders"> per selection
// so it submits cleanly inside a server-action <form>.
export function StakeholderSelect({
  people,
  defaultSelectedIds = [],
}: {
  people: Profile[];
  defaultSelectedIds?: string[];
}) {
  const [selected, setSelected] = useState<string[]>(defaultSelectedIds);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  const matches = useMemo(() => {
    const q = query.toLowerCase();
    return people
      .filter((p) => !selected.includes(p.id))
      .filter(
        (p) =>
          !q ||
          (p.full_name ?? "").toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [people, selected, query]);

  function add(id: string) {
    setSelected((s) => [...s, id]);
    setQuery("");
    inputRef.current?.focus();
  }
  function remove(id: string) {
    setSelected((s) => s.filter((x) => x !== id));
  }

  return (
    <div className="relative">
      {selected.map((id) => (
        <input key={id} type="hidden" name="stakeholders" value={id} />
      ))}

      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1.5">
        {selected.map((id) => {
          const p = byId.get(id);
          if (!p) return null;
          return (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-full bg-accent/10 py-0.5 pl-2 pr-1 text-xs text-accent"
            >
              {p.full_name ?? p.email}
              <button
                type="button"
                onClick={() => remove(id)}
                className="grid h-4 w-4 place-items-center rounded-full hover:bg-accent/20"
                aria-label={`Remove ${p.full_name ?? p.email}`}
              >
                <X size={11} />
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          placeholder={selected.length ? "" : "Add stakeholders…"}
          className="min-w-[120px] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted"
        />
      </div>

      {open && matches.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(p.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg"
              >
                <span className="grid h-6 w-6 place-items-center rounded-full bg-accent/15 text-[11px] font-medium text-accent">
                  {(p.full_name ?? p.email)[0]?.toUpperCase()}
                </span>
                <span className="flex-1 truncate">{p.full_name ?? p.email}</span>
                <span className="truncate text-xs text-muted">{p.email}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
