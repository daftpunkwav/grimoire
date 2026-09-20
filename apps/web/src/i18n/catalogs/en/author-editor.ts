/**
 * @file i18n/catalogs/en/author-editor
 * @description Author dashboard, article editor, animation editor.
 */
import type { MessageCatalog } from "../types.js";

export const authorEditor = {
  needAuthor: {
    title: "Author permission required",
    description: "Only authors can publish articles and animations.",
    goApply: "Apply to become an author",
  },
  article: {
    notFound: "Article does not exist",
    newArticle: "New article",
    editArticle: "Edit article",
    new: "+ New article",
    status: "Status: {status}",
    fields: {
      title: "Title",
      slug: "Slug (optional)",
      slugAuto: "Auto-generate",
      category: "Category",
      difficulty: "Difficulty",
      engineering: "Engineering practice",
    },
    difficulty: {
      intro: "Intro",
      intermediate: "Intermediate",
      advanced: "Advanced",
    },
    actions: {
      saveDraft: "Save draft",
      publish: "Publish",
      loadFailed: "Failed to load",
      saveFailed: "Failed to save",
      submitFailed: "Failed to submit",
    },
  },
  animation: {
    untitled: "Untitled animation",
    needOneStep: "At least one step is required",
    loadFailed: "Failed to load",
  },
} as const satisfies MessageCatalog["authorEditor"];
