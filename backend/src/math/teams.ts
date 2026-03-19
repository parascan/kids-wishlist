import teamMap from '../data/team-map.json';

/**
 * Resolves a source-specific team name to a canonical team ID.
 * Returns null if the team is not in the dictionary (caller decides how to handle).
 */
export function resolveTeam(sourceName: string): string | null {
  return (teamMap as Record<string, string>)[sourceName] ?? null;
}
