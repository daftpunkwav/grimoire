/**
 * @file i18n/catalogs/en/profile
 * @description Profile page copy.
 */
import type { MessageCatalog } from "../types.js";

export const profile = {
  loading: "Loading\u2026",
  needLogin: {
    title: "Please log in",
    description: "Guests can browse public knowledge; logging in grants you a reader identity.",
    goLogin: "Go to login",
  },
  guest: {
    description: "Guests can browse public knowledge; logging in grants you a reader identity.",
  },
} as const satisfies MessageCatalog["profile"];
