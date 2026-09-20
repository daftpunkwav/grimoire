/**
 * @file providerSecret
 * @description Seal API keys on `ProviderConfig` so they never leak via JSON.stringify or log dumps.
 *
 * Responsibilities:
 * - Move the plaintext `apiKey` onto a non-enumerable `Symbol` slot; the public `apiKey` field is always an empty string after sealing.
 * - Expose `providerApiKey` for adapters to read the key from the sealed slot, with a fallback for tests that construct plain-text providers.
 *
 * This service is the only workspace that holds provider credentials.
 */
import type { ProviderConfig } from './types.js';

const API_KEY = Symbol('llm.apiKey');

type SealedProvider = ProviderConfig & { [API_KEY]?: string };

/** Return a copy safe to hand to callers — the enumerable fields never contain the plaintext key. */
export function sealProvider(p: ProviderConfig): ProviderConfig {
  const existing = (p as SealedProvider)[API_KEY];
  if (existing && !p.apiKey) return p;
  const secret = p.apiKey || existing || '';
  const sealed: ProviderConfig = { ...p, apiKey: '' };
  Object.defineProperty(sealed, API_KEY, {
    value: secret,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return sealed;
}

/** Adapter key reader: prefer the sealed slot, fall back to the plaintext `apiKey` for test-only constructions. */
export function providerApiKey(p: ProviderConfig): string {
  return (p as SealedProvider)[API_KEY] || p.apiKey || '';
}
