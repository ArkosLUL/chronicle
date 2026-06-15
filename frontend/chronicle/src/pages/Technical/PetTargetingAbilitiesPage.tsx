import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Loader2, PawPrint, Search } from "lucide-react";
import { Card } from "@/components/ui/Card/Card";
import { SpellIdTooltip } from "@/components/ui/SpellIdTooltip/SpellIdTooltip";

interface PetTargetingAbility {
  id: number;
  name: string;
  class?: string; // Empty/absent when not a class ability (SpellClassSet=Generic).
  reasons: string[];
  omitReason?: string; // Non-empty when explicitly excluded from pet ownership detection.
}

// Spell IDs from the hardcoded petOwnerSpells map in
// combatlog/parser/wotlk/synthetic/petownership.go
const PET_OWNER_SPELLS = new Set([
  // Hunter — Mend Pet (all ranks)
  136, 3111, 3661, 3662, 13542, 13543, 13544, 27046, 33976, 48989, 48990,
  // Hunter — Kill Command
  34026,
  // Warlock — Fel Synergy
  54181,
  // Warlock — Health Funnel (all ranks)
  755, 3698, 3699, 3700, 11693, 11694, 11695, 27259, 40671, 47855, 47856,
  // Warlock — Master Demonologist (pet → player buff)
  35706,
  // Warlock — Demonic Knowledge (pet → player buff)
  35696,
]);

function usePetTargetingAbilities() {
  return useQuery({
    queryKey: ["assets", "pet-targeting-abilities"],
    queryFn: async () => {
      const response = await fetch("/api/v1/assets/pet-targeting-abilities.json");
      if (!response.ok) {
        throw new Error("Failed to fetch pet targeting abilities");
      }
      return response.json() as Promise<PetTargetingAbility[]>;
    },
    staleTime: 24 * 60 * 60 * 1000, // 1 day
    retry: false,
  });
}

type FilterMode = "all" | "hardcoded" | "not-hardcoded";
type ClassFilter = "all" | "class-only" | "non-class";
type OmitFilter = "all" | "included" | "omitted";

export function PetTargetingAbilitiesPage() {
  const { data: abilities, isLoading, error } = usePetTargetingAbilities();
  const [search, setSearch] = useState("");
  const [reasonFilter, setReasonFilter] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [classFilter, setClassFilter] = useState<ClassFilter>("all");
  const [classNameFilter, setClassNameFilter] = useState("");
  const [omitFilter, setOmitFilter] = useState<OmitFilter>("all");

  // Collect unique reason prefixes for the dropdown.
  const reasonPrefixes = useMemo(() => {
    if (!abilities) return [];
    const set = new Set<string>();
    for (const a of abilities) {
      for (const r of a.reasons) {
        const prefix = r.replace(/[[\s=].*/, "");
        set.add(prefix);
      }
    }
    return Array.from(set).sort();
  }, [abilities]);

  // Collect unique class names for the dropdown.
  const classNames = useMemo(() => {
    if (!abilities) return [];
    const set = new Set<string>();
    for (const a of abilities) {
      if (a.class) set.add(a.class);
    }
    return Array.from(set).sort();
  }, [abilities]);

  const filteredAbilities = useMemo(() => {
    let result = abilities ?? [];
    if (search.trim()) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(lowerSearch) ||
          a.id.toString().includes(search) ||
          a.reasons.some((r) => r.toLowerCase().includes(lowerSearch))
      );
    }
    if (reasonFilter) {
      result = result.filter((a) => a.reasons.some((r) => r.startsWith(reasonFilter)));
    }
    if (filterMode === "hardcoded") {
      result = result.filter((a) => PET_OWNER_SPELLS.has(a.id));
    } else if (filterMode === "not-hardcoded") {
      result = result.filter((a) => !PET_OWNER_SPELLS.has(a.id));
    }
    if (classFilter === "class-only") {
      result = result.filter((a) => !!a.class);
    } else if (classFilter === "non-class") {
      result = result.filter((a) => !a.class);
    }
    if (classNameFilter) {
      result = result.filter((a) => a.class === classNameFilter);
    }
    if (omitFilter === "included") {
      result = result.filter((a) => !a.omitReason);
    } else if (omitFilter === "omitted") {
      result = result.filter((a) => !!a.omitReason);
    }
    return result;
  }, [abilities, search, reasonFilter, filterMode, classFilter, classNameFilter, omitFilter]);

  // Count how many hardcoded spells appear in the generated data.
  const hardcodedCoverage = useMemo(() => {
    if (!abilities) return { found: 0, total: PET_OWNER_SPELLS.size };
    const found = abilities.filter((a) => PET_OWNER_SPELLS.has(a.id)).length;
    return { found, total: PET_OWNER_SPELLS.size };
  }, [abilities]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-4 max-w-4xl flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading pet targeting abilities…
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-4 max-w-4xl text-center text-sm text-destructive">
        Failed to load pet targeting abilities. Make sure the generated assets exist.
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-4 max-w-4xl">
      <Link
        to="/technical"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
      >
        <ArrowLeft className="h-3 w-3" />
        Back
      </Link>

      <div className="flex items-center gap-2 mb-1">
        <PawPrint className="h-5 w-5" />
        <h1 className="text-xl font-bold">Pet Targeting Abilities</h1>
        <span className="text-sm text-muted-foreground">
          ({(abilities ?? []).length.toLocaleString()} total)
        </span>
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        Spells identified from DBC data via ImplicitTarget, Effect type, or spell Attributes.
        <span className="ml-2 font-medium">
          Hardcoded coverage: {hardcodedCoverage.found}/{hardcodedCoverage.total}
        </span>
      </p>

      <div className="flex flex-wrap gap-3 mb-3">
        <select
          value={filterMode}
          onChange={(e) => setFilterMode(e.target.value as FilterMode)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">All spells</option>
          <option value="hardcoded">Hardcoded only ({hardcodedCoverage.found})</option>
          <option value="not-hardcoded">Not hardcoded</option>
        </select>
        <select
          value={classFilter}
          onChange={(e) => {
            setClassFilter(e.target.value as ClassFilter);
            if (e.target.value === "non-class") setClassNameFilter("");
          }}
          className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">Class &amp; non-class</option>
          <option value="class-only">Class abilities only</option>
          <option value="non-class">Non-class only</option>
        </select>
        {classFilter !== "non-class" && (
          <select
            value={classNameFilter}
            onChange={(e) => setClassNameFilter(e.target.value)}
            className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Any class</option>
            {classNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
        <select
          value={omitFilter}
          onChange={(e) => setOmitFilter(e.target.value as OmitFilter)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">Included &amp; omitted</option>
          <option value="included">Included only</option>
          <option value="omitted">Omitted only</option>
        </select>
        <select
          value={reasonFilter}
          onChange={(e) => setReasonFilter(e.target.value)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All reasons</option>
          {reasonPrefixes.map((prefix) => (
            <option key={prefix} value={prefix}>
              {prefix}
            </option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search spells or reasons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        {(search || reasonFilter || filterMode !== "all" || classFilter !== "all" || classNameFilter || omitFilter !== "all") && (
          <span className="text-xs text-muted-foreground self-center">
            {filteredAbilities.length} results
          </span>
        )}
      </div>

      <Card className="divide-y divide-border/30 max-h-[75vh] overflow-auto styled-scrollbar">
        {filteredAbilities.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No spells match your filters.
          </div>
        ) : (
          filteredAbilities.map((ability) => {
            const isHardcoded = PET_OWNER_SPELLS.has(ability.id);
            return (
              <a
                key={ability.id}
                href={`/wowdb/spell/${ability.id}`}
                className="flex items-center justify-between px-2 py-1.5 hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <span className="font-mono text-xs text-muted-foreground w-14 shrink-0">
                    {ability.id}
                  </span>
                  <SpellIdTooltip
                    spellId={ability.id}
                    name={ability.name}
                    size={16}
                    className="text-sm truncate"
                  />
                  {ability.class ? (
                    <span className="text-[10px] px-1 py-0.5 rounded shrink-0 bg-amber-500/15 text-amber-400">
                      {ability.class}
                    </span>
                  ) : (
                    <span className="text-[10px] px-1 py-0.5 rounded shrink-0 bg-muted text-muted-foreground">
                      Non-class
                    </span>
                  )}
                  {isHardcoded && (
                    <span className="text-[10px] px-1 py-0.5 rounded shrink-0 bg-green-500/15 text-green-400">
                      Hardcoded
                    </span>
                  )}
                  {ability.omitReason && (
                    <span
                      className="text-[10px] px-1 py-0.5 rounded shrink-0 bg-red-500/15 text-red-400"
                      title={ability.omitReason}
                    >
                      Omitted: {ability.omitReason}
                    </span>
                  )}
                  {ability.reasons.map((reason) => (
                    <span
                      key={reason}
                      className="text-[10px] px-1 py-0.5 rounded shrink-0 bg-blue-500/15 text-blue-400"
                    >
                      {reason}
                    </span>
                  ))}
                </div>
                <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
              </a>
            );
          })
        )}
      </Card>
    </div>
  );
}
