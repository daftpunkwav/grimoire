/**
 * @file schemas
 * @description Zod request-body schemas for the agent HTTP routes.
 *
 * Responsibilities:
 * - Define `explainSchemaFixed` (hover/click explain body) and `chatSchema` (panel chat body).
 * - Export inferred types (`ExplainBody`, `ChatBody`) so the orchestrator can read the validated shape without importing from `routes/`.
 *
 * Shared by both the routes and the orchestrator; the orchestrator never depends on `routes/`.
 */
import { z } from 'zod';

/** Agent route request-body validators — shared with the orchestrator so it does not depend on `routes/`. */
export const explainSchemaFixed = z.object({
  mode: z.enum(['hover', 'click']),
  selection: z.object({
    text: z.string().min(1).max(4000),
    context: z.string().max(2000).optional(),
    sectionId: z.string().max(120).optional(),
    route: z.string().max(300).optional(),
    articleSlug: z.string().max(120).optional(),
    title: z.string().max(200).optional(),
  }),
  style: z.string().max(40).optional(),
});

export const chatSchema = z.object({
  message: z.string().min(1).max(4000),
  conversationId: z.string().max(64).optional(),
  /** Guest conversation ACL: must match `conversation.guestKey`; ignored for logged-in users. */
  guestKey: z.string().min(16).max(80).optional(),
  context: z
    .object({
      route: z.string().max(300).optional(),
      articleSlug: z.string().max(120).optional(),
      sectionId: z.string().max(120).optional(),
    })
    .optional(),
  style: z.string().max(40).optional(),
  mode: z.enum(['fast', 'deep']).optional(),
  reasoningMode: z.enum(['deep_teach', 'react']).optional(),
  toolsEnabled: z.boolean().optional(),
});

export type ExplainBody = z.infer<typeof explainSchemaFixed>;
export type ChatBody = z.infer<typeof chatSchema>;
