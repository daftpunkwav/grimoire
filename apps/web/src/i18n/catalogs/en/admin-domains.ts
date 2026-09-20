/**
 * @file i18n/catalogs/en/admin-domains
 * @description Admin domains management copy.
 */
import type { MessageCatalog } from "../types.js";

export const adminDomains = {
  needAdmin: "Admin permission required",
  title: "Domain management",
  slugInvalid: "Slug may only contain lowercase letters, digits, and hyphens (-). Please edit it manually in the Slug input.",
  loadFailed: "Failed to load",
  createFailed: "Failed to create",
  deleteConfirm: "Delete the domain? (Articles will not be deleted, only unlinked.)",
  delete: "Delete",
} as const satisfies MessageCatalog["adminDomains"];
