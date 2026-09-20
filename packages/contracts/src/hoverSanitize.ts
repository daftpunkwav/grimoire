/**
 * @file hoverSanitize
 * @description Hover-card cleaning and quality gating — single source of truth shared between front end and back end.
 *
 * Responsibilities:
 * - Detection regexes (planning / meta / system echo / task echo / self-revision / self-talk)
 * - Private helpers that atomicize, dedupe, and truncate draft text
 * - Public functions: stripSelfRevisionDraft, isLikelyHoverTeaching, finalizeHoverCardText,
 *   progressiveHoverAnswer, extractHoverAnswer, isCompleteHoverAnswer, isSystemEcho,
 *   looksLikeHoverPlanning, isSafeHoverPublicAnswer, sanitizeHoverDisplay
 * - Frontend aliases (stripSelfRevisionClient, isSafeHoverDisplay, isLikelyHoverTeachingClient)
 *
 * Invariants:
 * - Regexes are add-only; stricter is OK, looser is NOT OK.
 * - Frontend aliases point directly to backend implementations to prevent drift between copies.
 * - Private helpers are not exported; only the product-facing public surface is.
 */

/** Hover card hard caps. */
export const HOVER_CARD_MAX_SENTENCES = 3;
export const HOVER_CARD_MAX_CHARS = 220;

// ─── Detection regexes ────────────────────────────────────────────────────────

/**
 * Writing-planning / inner-monologue prefix features.
 * Caution: do not use the bare substring "我需要" (it would also match "当我需要更高吞吐时…").
 */
const PLANNING_HINT =
  /(?:^|[。！？\n])我需要[:：]|结构如下|写作计划|检查清单|首先得|语气：|当前学习|内部思考|推理过程|Thought\s*[:：]|###\s*Thought|自我提醒|用户想|用户问|用户需要|让我先|我应该|首先分析|判断用户/;

/** Hover meta-narration / system-prompt echo. */
const HOVER_META =
  /思考过程|写作计划|检查清单|结构如下|自我提醒|内部思考|内部独白|推理过程|推理模式|提纲|大纲|(?:^|[。！？\n])我需要[:：]|我应该|我得先|(?:^|[。！？\n])让我|首先得|首先分析|首先考虑|用户想|用户问|用户需要|用户悬停|用户正在|当前学习|当前用户|当前页面|语气[:：]|风格[:：]|###\s*Thought|Thought\s*[:：]|Action\s*[:：]|Observation\s*[:：]|分析一下|判断用户|水平与策略|不要展开|禁止输出|硬性输出|Fast Direct/i;

/**
 * Model echoes "hard output rules" from the system prompt into the body.
 * Any match → that fragment / whole paragraph is not a valid explanation.
 */
const SYSTEM_ECHO =
  /只输出最终|禁止任何写作|自我检查|反复修改|每句必须写完|禁止半截|硬性输出|写作过程|对提示词|Fast Direct|禁止输出写作|适合卡片快览|不要讨论|不要任何写作|精炼[：:]\s*[。2]|禁止[「「:]|中文[，,]\s*精炼|以[。．]\s*[-•]|禁止[：:].{0,8}首先|快讲助手|单轮生成|不调用工具|不要别的|不要自我提醒/i;

/**
 * Echoes of task instructions or format commands.
 * Includes backend extensions: 只写\s*2 | 请用\s*2 | 知识点[，,].{0,8}要 | 完整话[，,].*结尾
 */
const TASK_ECHO =
  /用户现在需要|用户需要讲解|需要讲解.{0,12}知识点|要\s*2\s*[-~～到至]?\s*3\s*句|每句句号|每句结尾句号|结尾句号|句号结尾|只输出讲解|只写\s*2|请用\s*2|知识点[，,].{0,8}要|第[一二三1-3]句\s*[：:]|输出\s*2\s*或\s*3\s*句|完整话[，,].*结尾|不要别的|要准确.{0,8}句号|写两句完整|只输出这两句/i;

/**
 * Self-revision / writing self-check asides.
 * Merges frontend-only patterns: 讲核心 | 讲边界 | 讲接口 | 用户说 | 1\s*个类比 | 一个类比 | 要自然 | 没有多余
 */
const SELF_REVISION =
  /那调整下|哦调整|调整下[：:]|等下[，,：:]?|哦对[，,：:]|有没有冗余|没有元叙述|符合要求|符合卡片|卡片快览|2\s*[-~～到至]?\s*4\s*句|不要铺垫|要精炼|要短[，,]?\s*不要长|第一句讲|然后讲|讲核心|讲边界|讲接口|类比的话|要不要加|用户说|每句完整|每句结尾句号|直接讲正文|这样三句|1\s*个类比|一个类比|要自然|首先第一句|对[，,]\s*要短|对[，,]\s*这样|还要提一下|没有多余|讲清楚了|再顺一点|有没有要避免|或者再顺|两句[，,]讲|核心[、,，]作用[、,，]定位|不要别的/i;

/**
 * Writing-process aside phrases (may appear mid-sentence; cannot be matched by prefix alone).
 * Merges frontend-only patterns: 没有多余 | 用户说
 */
const SELF_TALK_PHRASE =
  /还要提一下|没有多余|讲清楚了|有没有要避免|再顺一点|要不要加|有没有冗余|符合要求|符合卡片|卡片快览|不要铺垫|要精炼|那调整|哦调整|调整下|等下要|类比的话|用户说|每句完整|每句结尾句号|直接讲正文|没有元叙述|要短[，,]?\s*不要长|2\s*[-~～到至]?\s*4\s*句|核心[、,，]作用[、,，]定位|或者有没有|或者再顺|不要别的/i;

// ─── Private helpers ───────────────────────────────────────────────────────────

/** Whether the sentence-ending looks like a truncated half-statement (e.g. unclosed quotes). */
function looksTruncatedTeachingTail(s: string): boolean {
  const t = (s || '').trim();
  if (!t) return true;
  const body = t.replace(/[。！]+$/, '');
  if (/[的与和及于在被把将可更越很太]$/.test(body) && body.length < 80) return true;
  // Token truncation: an unfinished sentence ending in "因为…是" / "…是"
  if (/因为[^。！]{1,32}是$/.test(body)) return true;
  if (/[^。！]{1,12}是$/.test(body) && /因为|而是|则是/.test(body)) return true;
  /** An opening quote without a matching closing quote. */
  const opens = (t.match(/["「"]/g) || []).length;
  const closes = (t.match(/["」"]/g) || []).length;
  if (opens > closes) return true;
  // Truncated tail like "只/仅 + single-char verb" (common model token truncation).
  if (/[只仅][学训调改练演测]\s*[。．]$/.test(t)) return true;
  return false;
}

/** Whether a single sentence / line looks like author aside / self-check / prompt echo (not knowledge content). */
function isSelfTalkSentence(s: string): boolean {
  const t = (s || '').trim().replace(/^[-*•]\s+/, '');
  if (!t) return true;
  if (
    SYSTEM_ECHO.test(t) ||
    TASK_ECHO.test(t) ||
    SELF_REVISION.test(t) ||
    HOVER_META.test(t) ||
    PLANNING_HINT.test(t)
  ) {
    return true;
  }
  if (SELF_TALK_PHRASE.test(t)) return true;
  // Truncated rule remnants like "精炼：。" or "（以。"
  if (/精炼[：:]\s*[。．]?$/.test(t) || /（以[。．]?$/.test(t) || /^[以以]\s*[。．]$/.test(t)) {
    return true;
  }
  // Pure command bullets / too-short fragments with no knowledge payload
  if (t.length < 10 && /禁止|必须|不要|只输出/.test(t)) return true;
  if (
    /^(对[，,]\s*(要短|这样|符合)|哦对|哦|嗯|等下|首先第|然后讲|接着讲|最后讲|要短|符合要求|有没有|类比的话|要不要|第一句|那可以|那调整|那改|好[，,]\s*这样|还要提)/.test(
      t,
    )
  ) {
    return true;
  }
  if (/^(首先|然后|接着|最后).{0,12}讲/.test(t)) return true;
  if (t.length < 48 && /讲[^。]{0,20}[：:]\s*$/.test(t)) return true;
  // Hover answer must not be a "writing-quality self-question".
  if (/[？?]$/.test(t)) {
    if (/还要|有没有|要不要|冗余|顺一点|类比|本质|避免|多余|清楚|两句|三句|调整|铺垫/.test(t)) {
      return true;
    }
    // Pure self-question (short interrogatives).
    if (t.length < 36) return true;
  }
  // Outline-style enumeration: 核心、作用、定位.
  if (/^[\u4e00-\u9fff]{1,8}([、,，][\u4e00-\u9fff]{1,8}){1,4}[。.]?$/.test(t)) return true;
  if (/符合要求|没有冗余|都是核心点|不要铺垫|精炼一下|讲清楚了|没有多余/.test(t)) return true;
  // Example-tone openings (prompt leakage).
  if (/^(比如|例如|譬如)[：:「""]?/.test(t)) return true;
  if (looksTruncatedTeachingTail(t)) return true;
  return false;
}

/**
 * Whether the unit looks like a keepable "explanation atom".
 * Hover accepts only statements / term definitions; rejects revision questions and asides.
 */
function isTeachingUnit(u: string): boolean {
  const t = (u || '').trim();
  if (t.length < 6) return false;
  if (isSelfTalkSentence(t)) return false;
  if (SELF_TALK_PHRASE.test(t) || SELF_REVISION.test(t)) return false;
  // Hover rejects units ending with ? (revisions are almost always self-questions).
  if (/[？?]\s*$/.test(t)) return false;
  if (SYSTEM_ECHO.test(t) || SELF_TALK_PHRASE.test(t) || SELF_REVISION.test(t)) return false;
  // Definition form "X：Y" may lack the trailing period.
  if (/^.{1,48}[：:].{4,}/.test(t) && !/[？?]/.test(t)) return true;
  // Complete declarative sentence.
  if (/[。！]/.test(t)) return true;
  // After bullet split: no period but still knowledge content.
  const cn = (t.match(/[\u4e00-\u9fff]/g) || []).length;
  if (
    t.length >= 12 &&
    (cn >= 8 || /[A-Za-z]{3,}/.test(t)) &&
    !/禁止|必须|只输出|写作|检查|修改|提示词|精炼/.test(t)
  ) {
    return true;
  }
  return false;
}

/** Clean a single draft segment: atomize per line / sentence / bullet and filter. */
function cleanDraftPart(part: string): string {
  let s = (part || '').replace(/\r\n/g, '\n').trim();
  if (!s) return '';
  s = s.replace(/^#{1,3}\s*Explain\b.*\n?/im, '').trim();
  // Rules and body glued with "- " → split into bullets first.
  s = s.replace(/\s*[-•]\s+/g, '\n');

  // Atomic units: end-of-sentence punctuation or newline.
  const units = s
    .split(/(?<=[。！？])|\n+/)
    .map((x) => x.trim().replace(/^[-*•]\s+/, ''))
    .filter(Boolean);

  const kept: string[] = [];
  for (const u of units) {
    // If a unit mixes asides / rule echoes, keep only the prefix.
    if (SELF_TALK_PHRASE.test(u) || SYSTEM_ECHO.test(u) || isSelfTalkSentence(u)) {
      const m = u.match(SELF_TALK_PHRASE) || u.match(SYSTEM_ECHO);
      if (m && m.index != null && m.index >= 8) {
        const prefix = u.slice(0, m.index).replace(/[，,、\s]+$/, '').trim();
        if (isTeachingUnit(prefix) || isTeachingUnit(prefix + '。')) {
          const piece = /[。！]$/.test(prefix) ? prefix : `${prefix}。`;
          if (!kept.includes(piece) && !kept.some((k) => k.includes(piece) || piece.includes(k))) {
            kept.push(piece);
          }
        }
      }
      continue;
    }
    if (isTeachingUnit(u)) {
      // Deduplicate: identical or already subsumed by a longer sentence.
      if (kept.includes(u)) continue;
      if (kept.some((k) => k === u || (u.length < 40 && k.includes(u)))) continue;
      kept.push(u);
    }
  }

  // Knowledge fragments missing a period get one appended to prevent run-ons.
  let out = kept
    .map((k) => {
      if (/[。！？]$/.test(k)) return k;
      return `${k}。`;
    })
    .join('')
    .replace(/\s*\n\s*/g, '')
    .trim();
  // Remove adjacent duplicate phrases.
  out = out.replace(/(.{10,48})\1+/g, '$1');
  if (out && !/[。！？]/.test(out) && /^.{1,40}[：:].{4,}/.test(out) && out.length >= 10) {
    // Allow "term: definition" without a trailing period.
  } else if (out && !/[。！？]/.test(out)) {
    // No sentence punctuation at all: do not emit a half-thought.
    if (out.length < 24) out = '';
  }

  // Truncation: cut at the last sentence terminator.
  if (out && !/[。！？]["'」』）)\]]*$/.test(out) && !/^.{1,40}[：:].{4,}$/.test(out)) {
    const end = Math.max(out.lastIndexOf('。'), out.lastIndexOf('！'));
    if (end >= 12) out = out.slice(0, end + 1).trim();
    else if (!/^.{1,40}[：:].{4,}/.test(out)) out = '';
  }

  if (!out) return '';
  if (SYSTEM_ECHO.test(out) || SELF_REVISION.test(out) || SELF_TALK_PHRASE.test(out)) return '';
  // High question-mark ratio = still a self-check draft.
  const q = (out.match(/[？?]/g) || []).length;
  const p = (out.match(/[。！]/g) || []).length;
  if (q > 0 && q >= p) return '';
  return out.slice(0, 600);
}

/**
 * Whether the final draft looks truncated by maxTokens (no terminal punctuation + half-tail).
 */
function looksTruncatedDraft(raw: string): boolean {
  const r = (raw || '').trim().replace(/^[-*•]\s+/, '');
  if (!r) return true;
  if (/[。！？]["'」』）)\]]*$/.test(r)) return false;
  // Definition form "X：Y" with enough length is considered complete.
  if (/^.{1,48}[：:].{16,}$/.test(r) && !/[，、的与和及]$/.test(r)) return false;
  if (r.length < 36) return true;
  // Tail stops at a connector / modifier → truncated.
  if (/[，、的与和及于在被把将可会能要]$/.test(r)) return true;
  if (/(上限|能力|表现|组件|语法|过程|循环|步骤)$/.test(r) && r.length < 64) return true;
  return false;
}

// ─── Public functions ──────────────────────────────────────────────────────────

/**
 * Extract the most recent "pure explanation" from a long revision text.
 * Strategy: split on "调整下"-style markers; walk backwards to find the first complete
 * explanation (the latest draft is often truncated).
 */
export function stripSelfRevisionDraft(raw: string): string {
  const s = (raw || '').trim();
  if (!s) return '';

  const revParts = s
    .split(
      /(?:那|哦)?调整[一一下下]*[：:]|(?:最终版|改成如下|重写如下|正文如下|调整为|改为)[：:]/i,
    )
    .map((p) => p.trim())
    .filter(Boolean);

  // Walk backwards from the last draft: fall back to the previous complete draft
  // when the latest one was truncated by maxTokens.
  if (revParts.length > 1) {
    for (let i = revParts.length - 1; i >= 0; i--) {
      const part = revParts[i];
      if (looksTruncatedDraft(part) && i > 0) continue;
      const cleaned = cleanDraftPart(part);
      if (cleaned.length >= 20 && isLikelyHoverTeaching(cleaned)) return cleaned;
      if (cleaned.length >= 28 && /[。！]/.test(cleaned)) return cleaned;
    }
  }

  return cleanDraftPart(s);
}

/**
 * Whether the string looks like a "showable pure explanation" (no revision / self-check traces).
 */
export function isLikelyHoverTeaching(s: string): boolean {
  const t = (s || '').trim();
  if (t.length < 10) return false;
  if (SYSTEM_ECHO.test(t) || TASK_ECHO.test(t) || SELF_REVISION.test(t) || SELF_TALK_PHRASE.test(t)) {
    return false;
  }
  if (looksLikeHoverPlanning(t)) return false;
  if (HOVER_META.test(t.slice(0, 160))) return false;
  if (/^(我|让我|用户想|用户问|用户需要|嗯|好的|总之|综上所述|对[，,]\s*(要短|这样)|哦对|还要提|等下|比如|例如|譬如)/.test(t)) {
    return false;
  }
  if (/^(首先|其次|然后|最后)(得|要|分析|考虑|判断|想|我|第)/.test(t)) return false;
  if (/^(首先|然后).{0,12}讲/.test(t)) return false;
  // Question-marks >= period-marks → self-check draft.
  const q = (t.match(/[？?]/g) || []).length;
  const p = (t.match(/[。！]/g) || []).length;
  if (q > 0 && q >= Math.max(1, p)) return false;

  const cn = (t.match(/[\u4e00-\u9fff]/g) || []).length;
  if (cn < 8) return false;
  const units = t.split(/(?<=[。！])/).map((x) => x.trim()).filter(Boolean);
  if (units.some((u) => isSelfTalkSentence(u) || looksTruncatedTeachingTail(u))) return false;
  // Declarative sentence.
  if (/[。！]/.test(t)) return true;
  // Term definition "X：Y" (may lack the trailing period).
  if (/^.{1,48}[：:].{4,}/.test(t) && !/[？?]/.test(t)) return true;
  if (/^[-*•]\s+\S/m.test(t) && /[。！]/.test(t)) return true;
  return false;
}

/** Extract the most "explanation-like" tail span from a long thinking block; empty if none. */
function extractTeachingSpan(raw: string): string {
  const th = (raw || '').trim();
  if (!th) return '';

  // Preferred: pure explanation after stripping revisions.
  const stripped = stripSelfRevisionDraft(th);
  if (stripped && isLikelyHoverTeaching(stripped)) return stripped;

  // Only accept the body after an Explain heading.
  const exp = th.match(/^#{1,3}\s*Explain\b.*$/im) || th.match(/^\*\*Explain\*\*.*$/im);
  if (exp && exp.index != null) {
    let body = th.slice(exp.index + exp[0].length).replace(/^\s*\n?/, '').trimStart();
    const nextH = body.search(/^#{1,3}\s+\w+/m);
    if (nextH > 0) body = body.slice(0, nextH).trim();
    const clean = stripSelfRevisionDraft(body);
    if (isLikelyHoverTeaching(clean)) return clean.slice(0, 600);
  }

  // Paragraphs: walk backwards.
  const parts = th.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const clean = stripSelfRevisionDraft(parts[i]);
    if (isLikelyHoverTeaching(clean)) return clean.slice(0, 600);
    const tail = trailingTeachingSentences(parts[i]);
    if (tail) return tail;
  }

  return trailingTeachingSentences(th);
}

/** Take the trailing contiguous non-meta complete sentences. */
function trailingTeachingSentences(raw: string): string {
  const stripped = stripSelfRevisionDraft(raw);
  if (stripped && isLikelyHoverTeaching(stripped)) return stripped;

  const sentences = raw
    .split(/(?<=[。！？])/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!sentences.length) return '';
  let start = sentences.length;
  for (let i = sentences.length - 1; i >= 0; i--) {
    const s = sentences[i];
    if (isSelfTalkSentence(s) || looksLikeHoverPlanning(s) || HOVER_META.test(s)) {
      break;
    }
    start = i;
  }
  if (start >= sentences.length) return '';
  const joined = sentences.slice(start).join('');
  const clean = stripSelfRevisionDraft(joined);
  return isLikelyHoverTeaching(clean) ? clean.slice(0, 600) : '';
}

/** Strip the "第二句：" / "第一句：" ordinal shells to reveal the real explanation. */
function stripSentenceOrdinal(sent: string): string {
  return (sent || '')
    .trim()
    .replace(/^[-*•]\s+/, '')
    .replace(/^第[一二三四五1-5]句\s*[：:]\s*/, '')
    .replace(/^(?:首先|然后|接着|最后)[，,:：]\s*/, '')
    .trim();
}

/**
 * Whether a single sentence may serve as a hover-card explanation (allow-list, fairly strict).
 */
function isCleanHoverSentence(sent: string): boolean {
  const t = stripSentenceOrdinal(sent);
  if (t.length < 8 || t.length > 110) return false;
  if (isSelfTalkSentence(t)) return false;
  if (SYSTEM_ECHO.test(t) || TASK_ECHO.test(t) || SELF_REVISION.test(t) || SELF_TALK_PHRASE.test(t)) {
    return false;
  }
  if (HOVER_META.test(t) || PLANNING_HINT.test(t)) return false;
  if (/[？?]/.test(t)) return false;
  if (/要\s*\d\s*[-~～到]?\s*\d\s*句|句号结尾|每句结尾句号|只输出|需要讲解|不要别的/.test(t)) {
    return false;
  }
  // Only block aside-style openings; do not flag teaching sentences like "首先，ReAct 是…".
  if (
    /^(对[，,]\s*(要短|这样|符合)|哦|嗯|等下|还要提|或者有没有|禁止|只输出|不要输出|中文[，,]|精炼|用户|比如|例如|譬如)/.test(
      t,
    )
  ) {
    return false;
  }
  if (/^(首先|然后).{0,8}讲/.test(t)) return false;
  if (/禁止|必须写完|写作过程|自我检查|反复修改|只输出最终/.test(t)) return false;
  if (looksTruncatedTeachingTail(t)) return false;
  const cn = (t.match(/[\u4e00-\u9fff]/g) || []).length;
  if (cn < 6) return false;
  return true;
}

/**
 * Final card copy: at most 3 sentences, ~220 chars, only complete declaratives.
 * All asides, rule echoes, and revision processes are stripped.
 *
 * Key invariant: when strip returns empty, do NOT fall back to `|| raw` —
 * otherwise pure-command sentences would leak through verbatim.
 */
export function finalizeHoverCardText(raw: string): string {
  const stripped = stripSelfRevisionDraft(raw);
  // Empty strip = full-text aside; hard-filter the raw per sentence, and still empty = failure.
  const source = stripped || (raw || '').trim();
  if (!source) return '';

  const units = source
    .replace(/\s*[-•]\s+/g, '\n')
    .split(/(?<=[。！])|\n+/)
    .map((x) => x.trim())
    .filter(Boolean);

  const kept: string[] = [];
  for (const u of units) {
    if (!isCleanHoverSentence(u)) continue;
    // Strip the "第二句：" shell before accepting the sentence.
    const body = stripSentenceOrdinal(u);
    if (!body || !isCleanHoverSentence(body)) continue;
    const sent = /[。！]$/.test(body) ? body : `${body}。`;
    if (kept.some((k) => k === sent || (sent.length < 40 && k.includes(sent)) || k.includes(sent.slice(0, 12)))) {
      continue;
    }
    kept.push(sent);
    if (kept.length >= HOVER_CARD_MAX_SENTENCES) break;
  }

  // Strip is empty AND hard-filter is empty → failure (never fall back to dirty raw).
  if (!kept.length) return '';

  let out = kept.join('');
  if (out.length > HOVER_CARD_MAX_CHARS) {
    let acc = '';
    for (const k of kept) {
      if ((acc + k).length > HOVER_CARD_MAX_CHARS) break;
      acc += k;
    }
    out = acc;
  }

  if (!out || !/[。！]/.test(out)) return '';
  if (SYSTEM_ECHO.test(out) || TASK_ECHO.test(out) || SELF_REVISION.test(out) || SELF_TALK_PHRASE.test(out)) {
    return '';
  }
  if (looksLikeHoverPlanning(out) && !isLikelyHoverTeaching(out)) return '';
  // At least 1 sentence, at most 3.
  const n = (out.match(/[。！]/g) || []).length;
  if (n < 1 || n > HOVER_CARD_MAX_SENTENCES) {
    if (n > HOVER_CARD_MAX_SENTENCES) {
      let c = 0;
      let end = -1;
      for (let i = 0; i < out.length; i++) {
        if (out[i] === '。' || out[i] === '！') {
          c += 1;
          if (c === HOVER_CARD_MAX_SENTENCES) {
            end = i;
            break;
          }
        }
      }
      if (end > 0) out = out.slice(0, end + 1);
    } else return '';
  }
  // Truncated tail sentence: drop it and keep the rest if still complete (avoid discarding the whole).
  let sentences = out.split(/(?<=[。！])/).map((x) => x.trim()).filter(Boolean);
  while (
    sentences.length > 0 &&
    (looksTruncatedTeachingTail(sentences[sentences.length - 1]) ||
      isSelfTalkSentence(sentences[sentences.length - 1]))
  ) {
    sentences.pop();
  }
  if (!sentences.length) return '';
  out = sentences.join('');
  if (!out || !/[。！]/.test(out)) return '';
  return out.slice(0, HOVER_CARD_MAX_CHARS + 20);
}

/**
 * Hover streaming: returns showable body only when high-confidence "explanation".
 */
export function progressiveHoverAnswer(thinking: string, text: string): string {
  return finalizeHoverCardText(`${text || ''}\n${thinking || ''}`);
}

/**
 * Hover-only unified exit — clean + truncate to a 2-3 sentence card.
 * Prefers a >= 2 sentence complete explanation; falls back to a single sentence only if it passes the completeness gate.
 */
export function extractHoverAnswer(thinking: string, text: string): string {
  const t = (text || '').trim();
  const th = (thinking || '').trim();
  const tries = [
    finalizeHoverCardText(`${th}\n${t}`),
    finalizeHoverCardText(t),
    finalizeHoverCardText(th),
    finalizeHoverCardText(extractTeachingSpan(th)),
    finalizeHoverCardText(stripSelfRevisionDraft(`${th}\n${t}`)),
  ];
  const scored = tries
    .filter((a) => a && isLikelyHoverTeaching(a) && !looksLikeHoverPlanning(a) && isCompleteHoverAnswer(a))
    .sort((a, b) => {
      const na = (a.match(/[。！]/g) || []).length;
      const nb = (b.match(/[。！]/g) || []).length;
      // More sentences first; break ties by length.
      if (nb !== na) return nb - na;
      return b.length - a.length;
    });
  if (scored[0]) return scored[0];
  // Fallback: complete-card contract (may be a single sentence).
  for (const a of tries) {
    if (a && isCompleteHoverAnswer(a)) return a;
  }
  return '';
}

/**
 * Cache quality gate: incomplete / planning-style / out-of-range fragments are never cached.
 * Industrial policy: better miss-and-refetch than cache a half-answer that poisons future lookups.
 */
export function isCompleteHoverAnswer(s: string): boolean {
  const t = (s || '').trim();
  if (t.length < 12 || t.length > HOVER_CARD_MAX_CHARS + 40) return false;
  if (looksLikeHoverPlanning(t)) return false;
  if (SYSTEM_ECHO.test(t) || TASK_ECHO.test(t) || SELF_REVISION.test(t) || SELF_TALK_PHRASE.test(t)) {
    return false;
  }
  if (HOVER_META.test(t.slice(0, 160))) return false;
  if (
    /讲解失败|暂无讲解|暂无输出|思考过程|推理过程|内部思考|只输出最终|自我检查|用户现在需要|要\s*2\s*[-~]?\s*3\s*句|每句结尾句号|不要别的/.test(
      t,
    )
  ) {
    return false;
  }
  if (/^(我|让我|用户想|用户问|用户需要|首先得|首先要|首先分析|对[，,]|哦|首先第|还要|或者|等下|比如|例如|譬如)/.test(t)) {
    return false;
  }
  if (/[，、与和或及]$/.test(t)) return false;
  if (/[？?]/.test(t)) return false;
  if (!/[。！]/.test(t)) return false;
  const n = (t.match(/[。！]/g) || []).length;
  if (n < 1 || n > HOVER_CARD_MAX_SENTENCES) return false;
  // Reject "half-answer with appended period": too-short single sentences or typical truncation tails.
  if (n === 1 && t.length < 18) return false;
  if (n === 1 && /(?:上限|能力|表现|组件|语法|过程)。$/.test(t) && t.length < 36) return false;
  // Single-sentence starting with a leftover "第二句" shell.
  if (/^第[一二三1-3]句/.test(t)) return false;
  // Any aside or truncated unit → reject (prevent dirty full text from clearing the gate).
  const units = t.split(/(?<=[。！])/).map((x) => x.trim()).filter(Boolean);
  if (units.some((u) => isSelfTalkSentence(u) || looksTruncatedTeachingTail(u))) return false;
  return true;
}

/**
 * Whether the output echoes the system prompt's hard rules or task format commands.
 * Shared by hover-card and deep/chat "thinking" surfaces; any match is treated as internal leakage.
 */
export function isSystemEcho(s: string): boolean {
  const t = (s || '').trim();
  if (!t) return false;
  return SYSTEM_ECHO.test(t) || TASK_ECHO.test(t);
}

export function looksLikeHoverPlanning(s: string): boolean {
  const t = (s || '').trim();
  if (!t) return false;
  const head = t.slice(0, 160);
  if (PLANNING_HINT.test(head) || HOVER_META.test(head) || SYSTEM_ECHO.test(t) || TASK_ECHO.test(t)) {
    return true;
  }
  if (SELF_REVISION.test(t) || SELF_TALK_PHRASE.test(t)) return true;
  // Multiple "- 禁止/只输出" lines look like rule echoes.
  if ((t.match(/[-•]\s*(只输出|禁止|必须|不要)/g) || []).length >= 1) return true;
  if ((head.match(/^[-*]\s+/gm) || []).length >= 2 && /需要|禁止|规则|结构|语气|只输出|写作/.test(head)) {
    return true;
  }
  const q = (t.match(/[？?]/g) || []).length;
  const pCount = (t.match(/[。！]/g) || []).length;
  if (q >= 2) return true;
  if (q > 0 && q >= Math.max(1, pCount)) return true;
  const units = t.split(/(?<=[。！？])|\n+/).map((x) => x.trim()).filter(Boolean);
  if (units.length >= 2) {
    const talk = units.filter((x) => isSelfTalkSentence(x)).length;
    if (talk / units.length >= 0.35) return true;
  }
  return false;
}

/**
 * Hover cache / public answer: 2-3 declarative sentences, no asides (thinking / rules / revisions all rejected).
 * This is the shared front/back-end public-quality gate; the original local function in agent.ts was migrated here.
 */
export function isSafeHoverPublicAnswer(answer: string): boolean {
  const a = (answer || '').trim();
  if (!a) return false;
  if (!isCompleteHoverAnswer(a)) return false;
  if (looksLikeHoverPlanning(a)) return false;
  if (/[？?]/.test(a)) return false;
  if ((a.match(/[。！]/g) || []).length > 3) return false;
  if (a.length > 260) return false;
  return isLikelyHoverTeaching(a);
}

/**
 * Display cleaning: always strip asides per sentence; never pass through dirty raw just because it "looks complete".
 * Behavior matches the same-named function in the frontend hoverExplainCache.ts, but uses shared helpers.
 */
export function sanitizeHoverDisplay(raw: string): string {
  const s = (raw || '').trim();
  if (!s) return '';
  // First: strip revision / asides.
  const stripped = stripSelfRevisionDraft(s);
  if (stripped && isSafeHoverPublicAnswer(stripped)) return stripped.slice(0, HOVER_CARD_MAX_CHARS + 40);
  // Otherwise: hard-filter the raw per sentence.
  const units = s
    .replace(/\s*[-•]\s+/g, '\n')
    .split(/(?<=[。！])|\n+/)
    .map((x) => x.trim().replace(/^[-*•]\s+/, ''))
    .filter((u) => u && !isSelfTalkSentence(u) && !looksTruncatedTeachingTail(u));
  const kept: string[] = [];
  for (const u of units) {
    const sent = /[。！]$/.test(u) ? u : `${u}。`;
    if (sent.length < 8) continue;
    if (isSelfTalkSentence(sent) || looksTruncatedTeachingTail(sent)) continue;
    kept.push(sent);
    if (kept.length >= 3) break;
  }
  const out = kept.join('');
  if (out && isSafeHoverPublicAnswer(out)) return out.slice(0, HOVER_CARD_MAX_CHARS + 40);
  return '';
}

// ─── Frontend aliases (eliminate copies in hoverExplainCache.ts) ─────────────────────

/** @alias stripSelfRevisionDraft */
export const stripSelfRevisionClient = stripSelfRevisionDraft;

/** @alias isSafeHoverPublicAnswer */
export const isSafeHoverDisplay = isSafeHoverPublicAnswer;

/** @alias isLikelyHoverTeaching */
export const isLikelyHoverTeachingClient = isLikelyHoverTeaching;
