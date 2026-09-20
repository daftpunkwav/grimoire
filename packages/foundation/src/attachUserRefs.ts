/**
 * @file attachUserRefs
 * @description Cross-service helper that enriches rows with author name references.
 *
 * Responsibilities:
 * - Encapsulate the "collect authorIds → batch lookup → build Map → join per row" pipeline
 * - Return per-row mapped results with `author` resolved (undefined when unknown)
 *
 * Invariants:
 * - No business package may depend on this file beyond the published surface area.
 * - `UserSummaryPort` is provided by composition-root injection (no direct identity coupling).
 */
import type { UserSummaryPort } from '@core/contracts';

export async function attachUserRefs<T, R>(
  rows: T[],
  users: Pick<UserSummaryPort, 'getUserSummaries'>,
  keyOf: (row: T) => string | undefined,
  map: (row: T, author: { id: string; name: string } | undefined) => R,
): Promise<R[]> {
  const ids = [...new Set(rows.map(keyOf).filter(Boolean) as string[])];
  const authors = await users.getUserSummaries(ids);
  const byId = new Map(authors.map((a) => [a.id, a.name]));
  return rows.map((row) => {
    const id = keyOf(row);
    const author =
      id && byId.has(id) ? { id, name: byId.get(id)! } : undefined;
    return map(row, author);
  });
}
