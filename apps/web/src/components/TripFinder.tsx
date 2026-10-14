"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchFinder, type FinderPlace } from "@/lib/search";
import { openAssistant } from "./assistant/AssistantWidget";

export interface TripFinderStrings {
  label: string;
  placeholder: string;
  go: string;
  ask: string;
  askMessage: string; // "Tell me about {place}"
  noMatch: string;
  from: string;
  kinds: Record<string, string>;
}

/** "Where to?" combobox over every name a place goes by (en/hi/mr, old names, aliases). */
export function TripFinder({ places, strings: s, originLabel }: { places: FinderPlace[]; strings: TripFinderStrings; originLabel: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [chosen, setChosen] = useState<FinderPlace | null>(null);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => searchFinder(query, places, 6), [query, places]);

  const choose = (p: FinderPlace) => {
    setChosen(p);
    setQuery(p.label);
    setOpen(false);
  };
  const go = (p: FinderPlace | null = chosen ?? results[0] ?? null) => {
    if (p) router.push(p.href);
  };

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
      className="card relative mt-8 max-w-xl p-2"
    >
      <p className="flex items-center gap-2 px-3 pt-1.5 pb-2 text-xs text-basalt-600">
        <span className="font-semibold tracking-wider text-basalt-400 uppercase">{s.from}</span>
        <span className="font-medium text-basalt-800">{originLabel}</span>
        <span className="text-kumkum-500" aria-hidden="true">→</span>
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-sand-100 px-4 py-2.5">
          <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-kumkum-600" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" /></svg>
          <label htmlFor={`${listId}-input`} className="sr-only">{s.label}</label>
          <input
            ref={inputRef}
            id={`${listId}-input`}
            role="combobox"
            aria-expanded={open && results.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && results[active] ? `${listId}-${results[active]!.slug}` : undefined}
            autoComplete="off"
            value={query}
            placeholder={s.placeholder}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onChange={(e) => {
              setQuery(e.target.value);
              setChosen(null);
              setActive(0);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setOpen(true);
                setActive((a) => Math.min(a + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && open && results[active]) {
                e.preventDefault();
                const p = results[active]!;
                choose(p);
                go(p);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            className="min-w-0 flex-1 bg-transparent py-1 text-base text-basalt-950 outline-none placeholder:text-basalt-400"
          />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="flex-1 rounded-2xl bg-kumkum-600 px-5 py-3 font-semibold text-white transition hover:bg-kumkum-700 sm:flex-none">
            {s.go}
          </button>
          <button
            type="button"
            onClick={() => openAssistant(chosen || query.trim() ? s.askMessage.replace("{place}", chosen?.label ?? query.trim()) : undefined)}
            className="flex-1 rounded-2xl border border-basalt-900/15 bg-white px-4 py-3 text-sm font-semibold text-basalt-800 transition hover:border-kumkum-500 hover:text-kumkum-700 sm:flex-none"
          >
            {s.ask}
          </button>
        </div>
      </div>

      {open && (
        <ul id={listId} role="listbox" aria-label={s.label} className="etaxi-pop absolute inset-x-2 top-full z-20 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-basalt-900/10 bg-white p-1.5 shadow-2xl">
          {results.length === 0 ? (
            <li className="px-3 py-3 text-sm text-basalt-600">{s.noMatch}</li>
          ) : (
            results.map((p, i) => (
              <li
                key={p.slug}
                id={`${listId}-${p.slug}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => {
                  choose(p);
                  go(p);
                }}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 ${i === active ? "bg-kumkum-50" : ""}`}
              >
                <span className="min-w-0">
                  <span className="font-display block truncate text-base text-basalt-950">{p.label}</span>
                  {p.alt && <span className="block truncate text-xs text-basalt-600">{p.alt}</span>}
                </span>
                <span className="shrink-0 rounded-full bg-sand-100 px-2 py-0.5 text-[11px] font-semibold text-basalt-600">{s.kinds[p.kind] ?? p.kind}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </form>
  );
}
