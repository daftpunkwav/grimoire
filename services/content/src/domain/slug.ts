/**
 * @file domain/slug
 * @description Title-to-slug normalizer for the content domain (deliberately kept out of the DTO mapper).
 *
 * Responsibilities:
 * - `slugify`: trim/lowercase, collapse separators, strip punctuation outside `\w` and CJK, deduplicate hyphens, cap at 80 chars.
 *
 * Invariants:
 * - The CJK Unicode block is kept intact so Chinese titles survive the normalizer.
 * - The empty-title fallback uses a random suffix instead of a timestamp so two saves in the same
 *   millisecond still produce distinct slugs.
 */
import { randomBytes } from 'node:crypto';
export function slugify(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w\u4e00-\u9fff-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  // Empty-title fallback: random short suffix (not a timestamp) so two saves in the same
  // millisecond still produce distinct slugs.
  return base || `article-${Date.now().toString(36)}${randomBytes(3).toString('hex')}`;
}
