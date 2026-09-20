/**
 * @file i18n/catalogs/en/settings
 * @description Settings page and theme picker copy.
 */
import type { MessageCatalog } from "../types.js";

export const settings = {
  title: "Settings",
  section: {
    appearance: "Appearance (this device)",
    learning: "Learning / animation",
    agent: "Agent speaking style",
  },
  theme: {
    label: "Theme",
    light: "Light",
    dark: "Dark",
  },
  themeColors: {
    orange: "Warm orange",
    blue: "Cobalt blue",
    purple: "Iris purple",
    green: "Pine green",
    pink: "Rose pink",
  },
  learning: {
    autoplay: "Auto-play animations",
    speed: "Default playback speed",
  },
  agent: {
    styleLabel: "Agent speaking style",
    styleProfessional: "Professional",
    styleConcise: "Concise",
  },
} as const satisfies MessageCatalog["settings"];
