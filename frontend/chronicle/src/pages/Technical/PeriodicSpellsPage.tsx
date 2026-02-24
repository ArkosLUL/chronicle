import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Sparkles, Loader2, Search, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/Card/Card";
import { SpellIdTooltip } from "@/components/ui/SpellIdTooltip/SpellIdTooltip";

interface PeriodicSpell {
  id: number;
  name: string;
  has_direct: boolean;
}

function usePeriodicSpells() {
  return useQuery({
    queryKey: ["periodicSpells"],
    queryFn: async () => {
      const response = await fetch("/api/v1/wowdb/periodic-spells");
      if (!response.ok) {
        throw new Error("Failed to fetch periodic spells");
      }
      return response.json() as Promise<PeriodicSpell[]>;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

export function PeriodicSpellsPage() {
  const { data: spells, isLoading, error } = usePeriodicSpells();
  const [search, setSearch] = useState("");

  const filteredSpells = useMemo(() => {
    if (!spells) return [];
    if (!search.trim()) return spells;
    
    const lowerSearch = search.toLowerCase();
    return spells.filter(
      (spell) =>
        spell.name.toLowerCase().includes(lowerSearch) ||
        spell.id.toString().includes(search)
    );
  }, [spells, search]);

  // Sort by name, then by ID
  const sortedSpells = useMemo(() => {
    return [...filteredSpells].sort((a, b) => {
      const nameCompare = a.name.localeCompare(b.name);
      if (nameCompare !== 0) return nameCompare;
      return a.id - b.id;
    });
  }, [filteredSpells]);

  return (
    <div className="container mx-auto px-4 py-4 max-w-4xl">
      <Link
        to="/technical"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
      >
        <ArrowLeft className="h-3 w-3" />
        Back
      </Link>

      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-5 w-5" />
        <h1 className="text-xl font-bold">Periodic Spells</h1>
        {spells && (
          <span className="text-sm text-muted-foreground">
            ({spells.length.toLocaleString()})
          </span>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <Card className="p-4 bg-destructive/10 border-destructive/20">
          <p className="text-sm text-destructive">Failed to load: {error.message}</p>
        </Card>
      )}

      {spells && (
        <>
          <div className="flex gap-3 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            {search && (
              <span className="text-xs text-muted-foreground self-center">
                {filteredSpells.length} results
              </span>
            )}
          </div>

          <Card className="divide-y divide-border/30 max-h-[75vh] overflow-auto styled-scrollbar">
            {sortedSpells.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No spells match your search.
              </div>
            ) : (
              sortedSpells.map((spell) => (
                <a
                  key={spell.id}
                  href={`/wowdb/spell/${spell.id}`}
                  className="flex items-center justify-between px-2 py-1.5 hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs text-muted-foreground w-14 shrink-0">
                      {spell.id}
                    </span>
                    <SpellIdTooltip
                      spellId={spell.id}
                      name={spell.name}
                      size={16}
                      className="text-sm truncate"
                    />
                    {spell.has_direct && (
                      <span className="text-[10px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                        +Direct
                      </span>
                    )}
                  </div>
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
                </a>
              ))
            )}
          </Card>
        </>
      )}
    </div>
  );
}
