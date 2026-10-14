"use client";

import { useEffect, useState } from "react";

/**
 * Filter chips for the destination grid. The grid stays server-rendered; this sets
 * data-filter on it and CSS (globals.css) hides other groups. Choice is kept in the URL hash.
 */
export function KindFilter({ targetId, groups }: { targetId: string; groups: Array<{ key: string; label: string; count: number }> }) {
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const fromHash = new URLSearchParams(window.location.hash.slice(1)).get("type");
    if (fromHash && groups.some((g) => g.key === fromHash)) setFilter(fromHash);
  }, [groups]);

  useEffect(() => {
    document.getElementById(targetId)?.setAttribute("data-filter", filter);
  }, [filter, targetId]);

  const pick = (key: string) => {
    setFilter(key);
    history.replaceState(null, "", key === "all" ? "#destinations" : `#type=${key}`);
  };

  return (
    <div role="group" className="mt-6 flex flex-wrap gap-2">
      {groups.map((g) => (
        <button
          key={g.key}
          type="button"
          aria-pressed={filter === g.key}
          onClick={() => pick(g.key)}
          className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
            filter === g.key ? "border-kumkum-600 bg-kumkum-600 text-white shadow-md shadow-kumkum-600/20" : "border-basalt-900/10 bg-white text-basalt-800 hover:border-kumkum-500/60"
          }`}
        >
          {g.label}
          <span className={`ml-2 text-xs ${filter === g.key ? "text-white/80" : "text-basalt-400"}`}>{g.count}</span>
        </button>
      ))}
    </div>
  );
}
