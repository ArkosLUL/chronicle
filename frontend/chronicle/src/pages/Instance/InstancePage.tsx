import { useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useInstance, useInstanceDamageSummary, type EncounterDamageSummary } from "@/api/queries";
import type { ActivityPeriod, InstancePlayer, InstanceUnit, WoWEncounterWithHostiles } from "@/api/typesGenerated";
import { Card } from "@/components/ui/Card/Card";
import { InstancePageView } from "./InstancePageView";

// Types for the Instance page
export interface EnemyUnit {
  id: string;
  name: string;
  damageTaken: number; // damage taken from players
  damageDone: number;  // damage done to players
  periods: readonly ActivityPeriod[]; // activity periods for debugging
}

export interface Encounter {
  id: string;
  name: string;
  boss: boolean;
  kill: boolean;
  start_time: string;
  end_time: string;
  enemies?: EnemyUnit[];
  remaining?: string[]; // GUIDs of enemies that did not die
}

export interface Instance {
  id: string;
  name: string;
  realm?: string;
  startTime: string;
  endTime?: string;
  encounters: Encounter[];
  // GUID -> player info lookup
  players?: Record<string, InstancePlayer>;
  // GUID -> unit info lookup (creatures, pets, etc.)
  units?: Record<string, InstanceUnit>;
}

// Helper to get unit name from lookup, with fallback
function getUnitName(guidStr: string, units: Record<string, InstanceUnit>): string {
  const unit = units[guidStr];
  if (unit) {
    return unit.name;
  }
  // Fallback: try to show a short version of the GUID
  return `Enemy ${guidStr}`;
}

// Helper to transform API data to view data
function transformToInstance(
  apiInstance: {
    id: string;
    name: string;
    encounters: readonly WoWEncounterWithHostiles[];
    players: Record<string, InstancePlayer>;
    units: Record<string, InstanceUnit>;
  },
  damageSummary: EncounterDamageSummary[]
): Instance {
  const { players, units } = apiInstance;

  // Group damage summaries by encounter
  const damageByEncounter = new Map<string, EncounterDamageSummary[]>();
  for (const summary of damageSummary) {
    const existing = damageByEncounter.get(summary.encounter_id) || [];
    existing.push(summary);
    damageByEncounter.set(summary.encounter_id, existing);
  }

  // Map encounters with damage data
  const encounters: Encounter[] = apiInstance.encounters.map((enc) => {
    const encounterDamage = damageByEncounter.get(enc.id) || [];
    
    // Build a lookup for damage data by GUID
    const damageByGuid = new Map<string, EncounterDamageSummary>();
    for (const d of encounterDamage) {
      damageByGuid.set(String(d.unit_guid), d);
    }

    // Build enemies from encounter hostiles
    const enemies: EnemyUnit[] = enc.hostiles
      .map((hostile) => {
        const guidStr = String(hostile.id);
        const damage = damageByGuid.get(guidStr);
        return {
          id: guidStr,
          name: getUnitName(guidStr, units),
          damageTaken: damage?.damage_taken_total ?? 0, // damage they took from players
          damageDone: damage?.damage_done_total ?? 0,   // damage they dealt to players
          periods: hostile.periods,
        };
      })
      .sort((a, b) => b.damageTaken - a.damageTaken); // sort by damage taken (most damaged first)

    return {
      id: enc.id,
      name: enc.name,
      boss: enc.boss,
      kill: enc.kill,
      start_time: enc.start_time,
      end_time: enc.end_time,
      players,
      enemies,
      remaining: enc.remaining as string[] | undefined,
    };
  });

  // Compute instance timing from encounters
  const sortedEncounters = [...apiInstance.encounters].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );
  const startTime = sortedEncounters[0]?.start_time || new Date().toISOString();
  const endTime = sortedEncounters[sortedEncounters.length - 1]?.end_time;

  return {
    id: apiInstance.id,
    name: apiInstance.name,
    startTime,
    endTime,
    encounters,
    players,
    units,
  };
}

// Connected component that fetches data
export function InstancePage() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const navigate = useNavigate();

  const { data: apiInstance, isLoading: instanceLoading, error: instanceError } = useInstance(
    instanceId || "",
    { enabled: !!instanceId }
  );

  const { data: damageSummary, isLoading: damageLoading } = useInstanceDamageSummary(
    instanceId || "",
    { enabled: !!instanceId }
  );

  const instance = useMemo(() => {
    if (!apiInstance) return null;
    return transformToInstance(apiInstance, damageSummary || []);
  }, [apiInstance, damageSummary]);

  const isLoading = instanceLoading || damageLoading;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading instance data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (instanceError || !instance) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <Link
          to="/logs"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Logs
        </Link>
        <Card className="p-6">
          <p className="text-destructive">
            {instanceError?.message || "Failed to load instance"}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <InstancePageView
      instance={instance}
      onBack={() => navigate(-1)}
    />
  );
}
