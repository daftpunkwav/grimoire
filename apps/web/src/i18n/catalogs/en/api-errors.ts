/**
 * @file i18n/catalogs/en/api-errors
 * @description Front-end API client error messages.
 */
import type { MessageCatalog } from "../types.js";

export const apiErrors = {
  timeout: "Request timed out. Please try again later.",
  notFound: "Not found",
  network: "Network error. Please check your connection and try again.",
  unknown: "Request failed. Please try again later.",
  codes: {
    TIMEOUT: "TIMEOUT",
    NOT_FOUND: "NOT_FOUND",
    UNAUTHORIZED: "UNAUTHORIZED",
    FORBIDDEN: "FORBIDDEN",
    VALIDATION_FAILED: "VALIDATION_FAILED",
    INTERNAL: "INTERNAL",
  },
} as const satisfies MessageCatalog["apiErrors"];
