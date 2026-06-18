"use client";

import { useMemo, useRef, useState } from "react";
import { X, Plus } from "lucide-react";

// Free-text tag picker. Suggests existing tags as you type and lets you create a
// new one (Enter / comma / "Create" row). Emits hidden <input name="tags"> per tag.
export function TagSelect({
  suggestions,
  defaultTags = [],
}: {
  suggestions: string[];
  defaultTags?: string[];
}) {
  const [selected, setSelected] = useState<string[]>(defaultTags);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = query.trim();
  const matches = useMemo(() => {
    const ql = q.toLowerCase();
    return suggestions
      .filter((t) => !selected.includes(t))
      .filter((t) => !ql || t.toLowerCase().includes(ql))
      .slice(0, 6);
  }, [suggestions, selected, q]);

  const canCreate =
    q.length > 0 &&
    !selected.some((t) => t.toLowerCase() === q.toLowerCase()) &&
    !suggestions.some((t) => t.toLowerCase() === q.toLowerCase());

  function add(tag: string) {
    const clean = tag.trim();
    if (!clean || selected.some((t) => t.toLowerCase() === clean.toLowerCase())) return;
    setSelected((s) => [...s, clean]);
    setQuery("");
    inputRef.current?.focus();
  }
  function remove(tag: string) {
    setSelected((s) => s.filter((t) => t !== tag));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === ",") && q) {
      e.preventDefault();
      add(q);
    } else if (e.key === "Backspace" && !query && selected.length) {
      setSelected((s) => s.slice(0, -1));
    }
  }

  return (
    <div className="relative">
      {selected.map((t) => (
        <input key={t} type="hidden" name="tags" value={t} />
      ))}

      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1.5">
        {selected.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-full bg-violet-100 py-0.5 pl-2 pr-1 text-xs text-violet-700 dark:bg-violet-950 dark:text-violet-300"
          >
            #{t}
            <button
              type="button"
              onClick={() => remove(t)}
              className="grid h-4 w-4 place-items-center rounded-full hover:bg-violet-200/60 dark:hover:bg-violet-900"
              aria-label={`Remove ${t}`}
            >
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          placeholder={selected.length ? "" : "Add tags…"}
          className="min-w-[100px] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted"
        />
      </div>

      {open && (matches.length > 0 || canCreate) && (
        <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
          {matches.map((t) => (
            <li key={t}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(t)}
                className="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-bg"
              >
                <span className="text-muted">#</span>
                {t}
              </button>
            </li>
          ))}
          {canCreate && (
            <li>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(q)}
                className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm text-accent hover:bg-bg"
              >
                <Plus size={13} /> Create “{q}”
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
