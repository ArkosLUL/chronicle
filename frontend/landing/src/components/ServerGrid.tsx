import { useMemo, useState } from "react";
import type { Expansion, Client, Logging, ServerEntry, StatusTag } from "../types";
import { ServerCard } from "./ServerCard";

/** Preserve the order from the registry (sponsored entries float to top). */
function sortServers(servers: ServerEntry[]): ServerEntry[] {
  return [...servers].sort((a, b) => {
    if (a.sponsored && !b.sponsored) return -1;
    if (!a.sponsored && b.sponsored) return 1;
    return 0; // stable: keep registry order
  });
}

// --- Filter types ---

type FilterKey = "expansion" | "client" | "logging" | "status";

interface FilterOption {
  key: FilterKey;
  value: string;
  label: string;
}

/** Derive available filter options from the actual server list. */
function deriveFilters(servers: ServerEntry[]): FilterOption[] {
  const expansionLabels: Record<Expansion, string> = { vanilla: "Vanilla", tbc: "TBC", wotlk: "WotLK" };
  const clientLabels: Record<Client, string> = { "1.12.1": "1.12.1", "2.4.3": "2.4.3", "3.3.5a": "3.3.5a" };
  const loggingLabels: Record<Logging, string> = { server: "Server-side log", client: "Client-side log" };
  const statusLabels: Record<StatusTag, string> = {
    closed: "Closed", beta: "Beta", new: "New", hardcore: "Hardcore", fresh: "Fresh",
    progression: "Progression", "custom-content": "Custom Content",
  };

  const seen = new Set<string>();
  const filters: FilterOption[] = [];

  const add = (key: FilterKey, value: string, label: string) => {
    const id = `${key}:${value}`;
    if (!seen.has(id)) {
      seen.add(id);
      filters.push({ key, value, label });
    }
  };

  for (const s of servers) {
    add("expansion", s.expansion, expansionLabels[s.expansion]);
    add("client", s.client, clientLabels[s.client]);
    add("logging", s.logging, loggingLabels[s.logging]);
    for (const tag of s.status ?? []) {
      add("status", tag, statusLabels[tag]);
    }
  }

  return filters;
}

function matchesFilters(server: ServerEntry, active: Set<string>): boolean {
  if (active.size === 0) return true;

  // Group active filters by key — within a key it's OR, across keys it's AND
  const byKey = new Map<FilterKey, string[]>();
  for (const id of active) {
    const [key, value] = id.split(":") as [FilterKey, string];
    const arr = byKey.get(key) ?? [];
    arr.push(value);
    byKey.set(key, arr);
  }

  for (const [key, values] of byKey) {
    if (key === "status") {
      if (!values.some((v) => server.status?.includes(v as StatusTag))) return false;
    } else {
      if (!values.includes(server[key])) return false;
    }
  }
  return true;
}

// --- Filter pill ---

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? "rounded-full border border-primary/50 bg-primary/15 px-3 py-1 text-xs font-medium text-primary transition-colors"
          : "rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
      }
    >
      {label}
    </button>
  );
}

// --- Grid ---

export function ServerGrid({ servers }: { servers: ServerEntry[] }) {
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());

  const filterOptions = useMemo(() => deriveFilters(servers), [servers]);

  const toggle = (key: FilterKey, value: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      const id = `${key}:${value}`;
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sorted = useMemo(() => sortServers(servers), [servers]);

  const matches = useMemo(() => {
    if (activeFilters.size === 0) return null; // no filtering active
    const set = new Set<string>();
    for (const s of servers) {
      if (matchesFilters(s, activeFilters)) set.add(s.id);
    }
    return set;
  }, [servers, activeFilters]);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
          Servers using Chronicle
        </h2>
        <p className="mt-2 text-muted-foreground">
          Select a server to view raid logs, damage breakdowns, and more.
        </p>
      </div>

      {/* Filter bar */}
      <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
        {filterOptions.map((f) => {
          const id = `${f.key}:${f.value}`;
          return (
            <FilterPill
              key={id}
              label={f.label}
              active={activeFilters.has(id)}
              onClick={() => toggle(f.key, f.value)}
            />
          );
        })}
        {activeFilters.size > 0 && (
          <button
            onClick={() => setActiveFilters(new Set())}
            className="ml-1 rounded-full px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>

      {/* Grid — non-matching cards are greyed out instead of hidden */}
      <div className="grid auto-rows-[1fr] gap-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
        {sorted.map((server) => {
          const dimmed = matches !== null && !matches.has(server.id);
          return (
            <div
              key={server.id}
              className={`flex ${dimmed ? "opacity-30 grayscale pointer-events-none transition-all duration-200" : "transition-all duration-200"}`}
            >
              <ServerCard server={server} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
