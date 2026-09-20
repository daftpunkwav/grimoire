/**
 * @file runtime
 * @description Composition root for the agent service — the only place that wires internal collaborators together.
 *
 * Responsibilities:
 * - Accept external port dependencies (`deps`) and produce a fully wired `AgentRuntime`.
 * - Instantiate `conversation`, `hoverCache`, `memory`, `toolRegistry`, `toolLoop`, and `orchestrator` in dependency order.
 * - Expose every collaborator on the returned object for the router and for tests.
 *
 * Future microservice split: implement the ports with HTTP clients, then call this function unchanged.
 */
import type { AgentDeps } from './ports.js';
import { createAgentConversation } from './services/agentConversation.js';
import { createHoverCache } from './services/hoverCache.js';
import { createAgentMemory } from './services/agentMemory.js';
import { createAgentOrchestrator } from './services/agentOrchestrator.js';
import { createToolRegistry } from './lib/tools/registry.js';
import { createToolLoop } from './lib/tools/toolLoop.js';

export function createAgentRuntime(deps: AgentDeps) {
  const conversation = createAgentConversation(deps.prisma);
  const hoverCache = createHoverCache(deps.prisma);
  const memory = createAgentMemory(deps.prisma, deps.users, deps.articles);
  const toolRegistry = createToolRegistry(deps.articles);
  const toolLoop = createToolLoop(deps.llm, toolRegistry.executeTool);
  const orchestrator = createAgentOrchestrator(deps, {
    conversation,
    hoverCache,
    memory,
    toolLoop,
  });

  return {
    deps,
    conversation,
    hoverCache,
    memory,
    toolRegistry,
    toolLoop,
    orchestrator,
  };
}

export type AgentRuntime = ReturnType<typeof createAgentRuntime>;
