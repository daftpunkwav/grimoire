/**
 * @file i18n/catalogs/en/topic
 * @description Topic forum page copy.
 */
import type { MessageCatalog } from "../types.js";

export const topic = {
  title: "Community topics",
  subtitle: "Discussions, questions, and opinions",
  description: "Attach a knowledge article to dive deeper in a discussion",
  empty: "No topics yet",
  newTopic: "Post a new topic",
  noPermission: "No permission to post",
  loginToPost: "Log in to post",
} as const satisfies MessageCatalog["topic"];
