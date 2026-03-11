import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, ExternalLink, Loader2, Search } from "lucide-react";
import { Card } from "@/components/ui/Card/Card";
import { SpellIdTooltip } from "@/components/ui/SpellIdTooltip/SpellIdTooltip";

interface ClassSpell {
  id: number;
  name: string;
  spellDamageType: number;
}

type ClassSpellsData = Record<string, ClassSpell[]>;

// SpellDamageType bitmask values
const SPELL_DAMAGE_DIRECT = 0x01;
const SPELL_DAMAGE_PERIODIC = 0x02;
const SPELL_DAMAGE_PERIODIC_TRIGGER = 0x04;
const SPELL_DAMAGE_ACTIVE_DEBUFF = 0x08;
const SPELL_DAMAGE_NO_ENGAGE_COMBAT = 0x10;

function spellDamageTypeBadges(dt: number) {
  const badges: { label: string; className: string }[] = [];
  if (dt === 0) {
    badges.push({ label: "Unknown", className: "bg-muted text-muted-foreground" });
  }
  if (dt & SPELL_DAMAGE_DIRECT) {
    badges.push({ label: "Direct", className: "bg-red-500/15 text-red-400" });
  }
  if (dt & SPELL_DAMAGE_PERIODIC) {
    badges.push({ label: "Periodic", className: "bg-purple-500/15 text-purple-400" });
  }
  if (dt & SPELL_DAMAGE_ACTIVE_DEBUFF) {
    badges.push({ label: "ActiveDebuff", className: "bg-red-500/15 text-red-400" });
  }
  if (dt & SPELL_DAMAGE_NO_ENGAGE_COMBAT) {
    badges.push({ label: "NoEngageCombat", className: "bg-gray-500/15 text-gray-400" });
  }
  if (dt & SPELL_DAMAGE_PERIODIC_TRIGGER) {
    badges.push({ label: "PeriodicTrigger", className: "bg-blue-500/15 text-blue-400" });
  }
  return badges;
}

function useClassSpells() {
  return useQuery({
    queryKey: ["assets", "class-spells"],
    queryFn: async () => {
      const response = await fetch("/api/v1/assets/class-spells.json");
      if (!response.ok) {
        throw new Error("Failed to fetch class spells");
      }
      return response.json() as Promise<ClassSpellsData>;
    },
    staleTime: 24 * 60 * 60 * 1000, // 1 day
  });
}

export function ClassSpellsPage() {
  const { data: classSpells, isLoading, error } = useClassSpells();
  const [selectedClass, setSelectedClass] = useState("");
  const [search, setSearch] = useState("");
  const [damageTypeFilter, setDamageTypeFilter] = useState<number | null>(null);

  const classNames = useMemo(() => Object.keys(classSpells ?? {}).sort(), [classSpells]);

  // Auto-select first class when data loads
  const activeClass = selectedClass || classNames[0] || "";

  const spells = useMemo(() => classSpells?.[activeClass] ?? [], [classSpells, activeClass]);

  const filteredSpells = useMemo(() => {
    let result = spells;
    if (search.trim()) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(
        (spell) =>
          spell.name.toLowerCase().includes(lowerSearch) || spell.id.toString().includes(search)
      );
    }
    if (damageTypeFilter !== null) {
      if (damageTypeFilter === 0) {
        result = result.filter((s) => s.spellDamageType === 0);
      } else {
        result = result.filter((s) => (s.spellDamageType & damageTypeFilter) !== 0);
      }
    }
    return result;
  }, [spells, search, damageTypeFilter]);

  const totalSpells = useMemo(
    () => Object.values(classSpells ?? {}).reduce((sum, arr) => sum + arr.length, 0),
    [classSpells]
  );

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-4 max-w-4xl flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading class spells…
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-4 max-w-4xl text-center text-sm text-destructive">
        Failed to load class spells. Make sure the generated assets exist.
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

      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="h-5 w-5" />
        <h1 className="text-xl font-bold">Class Spells</h1>
        <span className="text-sm text-muted-foreground">({totalSpells.toLocaleString()} total)</span>
      </div>

      <div className="flex flex-wrap gap-3 mb-3">
        <select
          value={activeClass}
          onChange={(e) => {
            setSelectedClass(e.target.value);
            setSearch("");
          }}
          className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {classNames.map((name) => (
            <option key={name} value={name}>
              {name} ({(classSpells?.[name] ?? []).length})
            </option>
          ))}
        </select>
        <select
          value={damageTypeFilter === null ? "" : String(damageTypeFilter)}
          onChange={(e) => setDamageTypeFilter(e.target.value === "" ? null : Number(e.target.value))}
          className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All types</option>
          <option value="0">Unknown (no activity)</option>
          <option value={String(SPELL_DAMAGE_DIRECT)}>Direct</option>
          <option value={String(SPELL_DAMAGE_PERIODIC)}>Periodic</option>
          <option value={String(SPELL_DAMAGE_PERIODIC_TRIGGER)}>PeriodicTrigger</option>
          <option value={String(SPELL_DAMAGE_ACTIVE_DEBUFF)}>ActiveDebuff</option>
          <option value={String(SPELL_DAMAGE_NO_ENGAGE_COMBAT)}>NoEngageCombat</option>
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search spells..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        {(search || damageTypeFilter !== null) && (
          <span className="text-xs text-muted-foreground self-center">
            {filteredSpells.length} results
          </span>
        )}
      </div>

      <Card className="divide-y divide-border/30 max-h-[75vh] overflow-auto styled-scrollbar">
        {classNames.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No class spell data generated yet. Run the derived-statics generator.
          </div>
        ) : filteredSpells.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">No spells match your search.</div>
        ) : (
          filteredSpells.map((spell) => (
            <a
              key={spell.id}
              href={`/wowdb/spell/${spell.id}`}
              className="flex items-center justify-between px-2 py-1.5 hover:bg-muted/50 transition-colors group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-xs text-muted-foreground w-14 shrink-0">{spell.id}</span>
                <SpellIdTooltip
                  spellId={spell.id}
                  name={spell.name}
                  size={16}
                  className="text-sm truncate"
                />
                {spellDamageTypeBadges(spell.spellDamageType).map((badge) => (
                  <span
                    key={badge.label}
                    className={`text-[10px] px-1 py-0.5 rounded shrink-0 ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                ))}
              </div>
              <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
            </a>
          ))
        )}
      </Card>
    </div>
  );
}
