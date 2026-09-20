/**
 * @file llmAnswerExtract
 * @description LLM output parsing: split a "thinking draft + body" pair into the user-visible answer.
 *
 * Responsibilities:
 * - extractVisibleAnswer: returns `{ answer, thinking }` with the visible body separated from internal thought
 * - Internal planning / self-revision / system-rule echoes are filtered or masked
 *
 * Cross-service pure function: consumed by both services/llm (adapters) and services/agent (tool-loop).
 * Lives in foundation to eliminate cross-service source dependencies.
 */
import { isSystemEcho, looksLikeHoverPlanning } from '@core/contracts';

/**
 * Split "thinking draft + body" into the user-visible answer.
 * StepFun-style models often place planning / inner monologue / repeated revisions in `thinking`,
 * which must never be displayed to the user.
 *
 * A-04: system-rule echo gating at the unified exit —
 *  - body that echoes system rules is treated as invalid (triggers upstream fallback),
 *  - thinking that echoes system rules is masked (returned as empty), so internal prompt wording never leaks.
 */
export function extractVisibleAnswer(thinking: string, text: string): { answer: string; thinking: string } {
  const r = extractVisibleAnswerInner(thinking, text);
  if (r.answer && isSystemEcho(r.answer)) {
    return { answer: '', thinking: r.thinking };
  }
  if (r.thinking && isSystemEcho(r.thinking)) {
    return { answer: r.answer, thinking: '' };
  }
  return r;
}

function extractVisibleAnswerInner(
  thinking: string,
  text: string,
): { answer: string; thinking: string } {
  const t = (text || '').trim();
  const th = (thinking || '').trim();

  // Body already has a structural heading: prefer the body.
  if (t && (/^#{1,3}\s*Thought/im.test(t) || t.length > 40)) {
    if (looksLikeHoverPlanning(t) && th) {
      const cleaned = stripPlanningPreamble(t);
      if (cleaned.thinking) return cleaned;
    }
    return { answer: t, thinking: th };
  }

  // Pull the slice after a "### Thought" marker in thinking as the answer.
  const markers = [
    /^#{1,3}\s*Thought\b/im,
    /^###\s*Thought\b/im,
    /^\*\*Thought\*\*/im,
    /^Thought\s*[:：]/im,
  ];
  for (const re of markers) {
    const m = th.match(re);
    if (m && m.index != null) {
      const answer = th.slice(m.index).trim();
      const thinkingOnly = th.slice(0, m.index).trim();
      if (answer.length > 20) {
        return { answer, thinking: thinkingOnly || th.slice(0, Math.min(200, th.length)) };
      }
    }
  }

  // Strip obvious planning preamble.
  const cleaned = stripPlanningPreamble(th || t);
  if (cleaned.answer) return cleaned;

  if (t) return { answer: t, thinking: th };
  if (th && !looksLikeHoverPlanning(th)) return { answer: th, thinking: '' };
  if (th) return { answer: '', thinking: th };
  return { answer: '', thinking: '' };
}

function stripPlanningPreamble(raw: string): { answer: string; thinking: string } {
  const s = raw.trim();
  if (!s) return { answer: '', thinking: '' };
  const exp = s.search(/^#{1,3}\s*Explain\b/im);
  if (exp > 0) {
    return { answer: s.slice(exp).trim(), thinking: s.slice(0, exp).trim() };
  }
  const planLike = /^(我需要|首先|结构|语气|当前学习|要毒舌|用 Thought)/m.test(s);
  if (planLike && s.length > 120) {
    const parts = s.split(/\n{2,}/);
    if (parts.length >= 2) {
      const last = parts[parts.length - 1].trim();
      if (last.length > 40 && !/^(我需要|结构|语气)/.test(last)) {
        return { answer: last, thinking: parts.slice(0, -1).join('\n\n') };
      }
    }
  }
  return { answer: s, thinking: '' };
}
