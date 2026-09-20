/**
 * @file i18n/catalogs/en/admin-applications
 * @description Admin author application review copy.
 */
import type { MessageCatalog } from "../types.js";

export const adminApplications = {
  needAdmin: "Admin permission required",
  loading: "Loading\u2026",
  backToDashboard: "\u2190 Workspace",
  actionFailed: "Action failed",
  approve: "Approve",
  reject: "Reject",
} as const satisfies MessageCatalog["adminApplications"];
