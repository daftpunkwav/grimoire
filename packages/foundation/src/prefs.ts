/**
 * @file prefs
 * @description Preferences JSON parser shared between settings and agent consumers.
 *
 * Responsibilities:
 * - parsePrefs(raw) → returns a parsed object, or `{}` on missing/invalid input
 *
 * C-06: deduplicates identical parsers in settings.ts and agent.ts.
 */
export function parsePrefs(raw?: string | null): Record<string, unknown> {
  try {
    return JSON.parse(raw || '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
}
