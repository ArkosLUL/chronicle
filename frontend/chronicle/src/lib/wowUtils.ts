/**
 * Returns true when the instance should display the Heroic badge.
 *
 * Heroic is indicated by either:
 *  - `dynamic_difficulty > 0` (ICC-style toggle for raids), or
 *  - `difficulty_name` containing "Heroic" (e.g. "5 Player (Heroic)" dungeons).
 *
 * Accepts both snake_case (API SDK types) and camelCase (Instance page type).
 */
export function isHeroic(
  instance:
    | { dynamic_difficulty: number; difficulty_name: string }
    | { dynamicDifficulty?: number; difficultyName?: string },
): boolean {
  if ("dynamic_difficulty" in instance) {
    return (
      instance.dynamic_difficulty > 0 ||
      instance.difficulty_name.includes("Heroic")
    );
  }
  return (
    ((instance.dynamicDifficulty ?? 0) > 0) ||
    ((instance.difficultyName ?? "").includes("Heroic"))
  );
}
