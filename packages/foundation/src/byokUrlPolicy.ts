/**
 * @file byokUrlPolicy
 * @description Outbound URL policy for BYOK baseUrl (SSRF defense).
 *
 * Responsibilities:
 * - assertSafeByokBaseUrl: validate + normalize a BYOK baseUrl, throwing AppError(400, BYOK_URL_REJECTED) on rejection
 * - isSafeByokBaseUrl: non-throwing variant for Zod refine / frontend pre-check
 * - isPrivateOrSpecialIpv4: predicate for private / loopback / link-local / CGNAT / multicast ranges
 *
 * Invariants:
 * - Only user-controlled BYOK baseUrl is gated here; server-side env Providers are not restricted.
 * - Blocks: localhost, *.local/internal, RFC1918 ranges, CGNAT, link-local, multicast, IPv6 loopback / ULA / link-local.
 * - Rejects userinfo (URL with username:password) to avoid leaking credentials via logs/proxies.
 */
import { badRequest } from './errors.js';

const BLOCKED_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
]);

/** Whether the host is a private / link-local / loopback / special-purpose IPv4 address. */
export function isPrivateOrSpecialIpv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const parts = m.slice(1).map(Number);
  if (parts.some((n) => n > 255)) return false;
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 (incl. cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isBlockedIpv6(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === '::1' || h === '::') return true;
  // fe80::/10 link-local; fc00::/7 ULA; ::ffff:127.0.0.1 etc.
  if (h.startsWith('fe80:') || h.startsWith('fc') || h.startsWith('fd')) return true;
  if (h.startsWith('::ffff:')) {
    // IPv4-mapped IPv6: URL.hostname normalizes dotted-decimal to compressed hex
    // (e.g. [::ffff:127.0.0.1] → [::ffff:7f00:1]); both forms must be evaluated.
    const v4 = h.slice('::ffff:'.length);
    if (v4.includes('.')) {
      return isPrivateOrSpecialIpv4(v4);
    }
    // Hex form: 2 × 16-bit → restore 4 dotted-decimal octets.
    const hexParts = v4.split(':');
    if (hexParts.length === 2 && hexParts.every((p) => /^[0-9a-f]{1,4}$/.test(p))) {
      const hi = hexParts[0].padStart(4, '0');
      const lo = hexParts[1].padStart(4, '0');
      const decoded = [
        parseInt(hi.slice(0, 2), 16),
        parseInt(hi.slice(2, 4), 16),
        parseInt(lo.slice(0, 2), 16),
        parseInt(lo.slice(2, 4), 16),
      ].join('.');
      return isPrivateOrSpecialIpv4(decoded);
    }
  }
  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, '');
  if (BLOCKED_HOSTS.has(h)) return true;
  if (h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (isPrivateOrSpecialIpv4(h)) return true;
  if (isBlockedIpv6(h)) return true;
  return false;
}

/**
 * Validate and normalize a BYOK baseUrl.
 * Empty string is treated as "not configured" and returns ''.
 * On invalid input throws AppError(400, BYOK_URL_REJECTED).
 */
export function assertSafeByokBaseUrl(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw badRequest('BYOK baseUrl 不是合法 URL', 'BYOK_URL_REJECTED');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw badRequest('BYOK baseUrl 仅允许 http 或 https', 'BYOK_URL_REJECTED');
  }

  // Forbid userinfo (URL with username:password) — prevents credential leaks via logs / proxies.
  if (parsed.username || parsed.password) {
    throw badRequest('BYOK baseUrl 不允许包含用户名或密码', 'BYOK_URL_REJECTED');
  }

  if (isBlockedHostname(parsed.hostname)) {
    throw badRequest('BYOK baseUrl 禁止指向本机、内网或元数据地址', 'BYOK_URL_REJECTED');
  }

  // Normalize: strip trailing slashes so downstream resolve*Url works consistently.
  return trimmed.replace(/\/+$/, '');
}

/** Non-throwing variant: used by Zod refine / frontend pre-check. */
export function isSafeByokBaseUrl(raw: string): boolean {
  try {
    assertSafeByokBaseUrl(raw);
    return true;
  } catch {
    return false;
  }
}
