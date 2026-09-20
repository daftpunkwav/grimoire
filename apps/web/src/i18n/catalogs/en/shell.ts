/**
 * @file i18n/catalogs/en/shell
 * @description AppShell, navigation, error boundary, router 404.
 */
import type { MessageCatalog } from "../types.js";

export const shell = {
  nav: {
    home: "Home",
    knowledge: "Agent knowledge",
    llm: "LLM basics",
    topics: "Topics",
    news: "Frontier news",
    agent: "Agent assistant",
    profile: "Profile",
    settings: "Settings",
    authorDashboard: "Author workspace",
    adminDomains: "Domain management",
    adminApplications: "Author application review",
    login: "Log in",
    register: "Sign up",
    logout: "Log out",
  },
  notFound: {
    title: "Page not found",
    description: "The address you visited does not match any page.",
    goHome: "Back to home",
  },
  errorBoundary: {
    title: "Something went wrong",
    description: "The page failed to load. Please refresh and try again.",
  },
} as const satisfies MessageCatalog["shell"];
