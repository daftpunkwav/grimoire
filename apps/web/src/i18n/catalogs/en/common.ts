/**
 * @file i18n/catalogs/en/common
 * @description Common user-visible strings (loading states, empty states, generic errors).
 */
import type { MessageCatalog } from "../types.js";

export const common = {
  loading: "Loading\u2026",
  empty: {
    articles: "No articles yet",
    intro: "No summary yet",
    explain: "No explanation yet",
    frames: "No animation frames",
    toc: "This article has no table of contents",
  },
  error: {
    loadFailed: "Failed to load",
    saveFailed: "Failed to save",
    submitFailed: "Failed to submit",
    unknown: "An unknown error occurred",
  },
  success: {
    saved: "Saved",
    profileSaved: "Profile saved",
    apiKeySaved: "Saved (your API key is stored only in your account, never uploaded to the server)",
    cacheCleared: "Cleared: browser cache {l1} entries, server cache {cleared} entries",
  },
  view: "view",
} as const satisfies MessageCatalog["common"];
