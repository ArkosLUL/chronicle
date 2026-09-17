/**
 * Conversion between the planner's in-memory state and the typed
 * RaidCompData wire format (sparse placements, no nulls).
 */
import type { RaidCompData, RaidCompEntry, RaidCompPlacement } from "@/api/typesGenerated";
import type { Board, PlayerEntry, SlotEntry } from "./types";
import { GROUP_SIZE } from "./types";

/** Prefix for player entries that don't reference a roster character. */
const STANDALONE_ID_PREFIX = "standalone:";

function entryToSaved(entry: SlotEntry): RaidCompEntry {
  if (entry.kind === "placeholder") {
    return {
      kind: "placeholder",
      class: entry.cls,
      spec: entry.spec || undefined,
      note: entry.note || undefined,
    };
  }
  // Synthetic ids (raid-helper imports, previously loaded standalones) are
  // not roster characters — persist them by name only.
  const isRosterCharacter = !entry.id.includes(":");
  return {
    kind: "player",
    character_id: isRosterCharacter ? entry.id : undefined,
    name: entry.name,
    class: entry.cls,
    spec: entry.spec || undefined,
    note: entry.note || undefined,
  };
}

export function compositionToData(
  board: Board,
  bench: SlotEntry[],
  groupNotes: Record<number, string>,
): RaidCompData {
  const placements: RaidCompPlacement[] = [];
  board.forEach((slots, gi) => {
    slots.forEach((entry, si) => {
      if (entry) placements.push({ group: gi, slot: si, entry: entryToSaved(entry) });
    });
  });
  return {
    groups: board.length,
    placements,
    bench: bench.map(entryToSaved),
    group_notes: board.map((_, gi) => groupNotes[gi] ?? ""),
  };
}

function savedToEntry(
  saved: RaidCompEntry,
  key: string,
  rosterById: Map<string, PlayerEntry>,
): SlotEntry {
  if (saved.kind === "placeholder") {
    return { kind: "placeholder", cls: saved.class, spec: saved.spec ?? "", note: saved.note ?? "" };
  }
  const fromRoster = saved.character_id ? rosterById.get(saved.character_id) : undefined;
  if (fromRoster) {
    return { ...fromRoster, spec: saved.spec ?? fromRoster.spec, note: saved.note ?? "" };
  }
  return {
    kind: "player",
    id: saved.character_id || `${STANDALONE_ID_PREFIX}${key}`,
    name: saved.name || "Unknown",
    cls: saved.class,
    spec: saved.spec ?? "",
    reportedSpec: "",
    role: "",
    specRoles: [],
    avgParse: -1,
    level: 0,
    realmName: "",
    note: saved.note ?? "",
  };
}

export function dataToComposition(
  data: RaidCompData,
  roster: PlayerEntry[],
): { board: Board; bench: SlotEntry[]; groupNotes: Record<number, string> } {
  const rosterById = new Map(roster.map((p) => [p.id, p]));
  const board: Board = Array.from({ length: data.groups }, () =>
    Array<SlotEntry | null>(GROUP_SIZE).fill(null),
  );
  for (const placement of data.placements) {
    if (board[placement.group]?.[placement.slot] !== undefined) {
      board[placement.group][placement.slot] = savedToEntry(
        placement.entry,
        `${placement.group}:${placement.slot}`,
        rosterById,
      );
    }
  }
  const bench = data.bench.map((entry, i) => savedToEntry(entry, `bench:${i}`, rosterById));
  const groupNotes: Record<number, string> = {};
  (data.group_notes ?? []).forEach((note, gi) => {
    if (note) groupNotes[gi] = note;
  });
  return { board, bench, groupNotes };
}
