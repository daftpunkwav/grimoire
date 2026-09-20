## Git conventions

### Commit messages (Conventional Commits)

```
<type>: <subject>
```

`type` is a standard type such as `feat`/`fix`/`docs`/`refactor`/`chore`/`test`/`perf`;
the subject is imperative, ≤ 50 characters, describes the behavior directly, and carries
no internal phase numbers (e.g. P0–P9); one commit does one thing.

Examples: `feat: initialize project repository`, `fix: long-session context overflow`

### Branch naming

```
<type>/<kebab-case-description>
```

`type` as above; the description is kebab-case.

Examples: `feat/context-compaction`, `fix/memory-dedup`

## Engineering conventions

- **English-only source.** Code, comments, identifiers, and commit messages
  are English. Documentation ships in English with Simplified Chinese mirrors.
  User-visible UI copy lives in i18n catalogs under
  `apps/web/src/i18n/catalogs/` (`zh-CN` canonical, `en` type-pinned) — never
  inline. Enforced by `pnpm --filter @grimoire/web check:i18n`.
- **File header required.** Every `.ts` / `.tsx` source file opens with a
  JSDoc block shaped like:

  ```ts
  /**
   * @file <module-name>
   * @description <one-sentence purpose>.
   *
   * Responsibilities:
   * - <bullet 1>
   * - <bullet 2>
   *
   * <optional invariants or "no UI / no LLM / etc." note>
   */
  ```

  Test files follow the same template. The full template lives in
  `AGENTS.local.md`.
- **Composition root is unique.** `services/api/src/compose.ts` is the only
  place that constructs port implementations and wires them. Any other
  service file that needs another domain must import only from
  `@grimoire/contracts` (the port) — never from the other service's source.
- **Iron rules** are enforced by `scripts/check-boundaries.mjs` and
  `scripts/check-package-deps.mjs`. See
  [docs/operations/quality-gates.md](docs/operations/quality-gates.md) for
  what each gate owns and what a failure means.
- **No silent downgrades.** When a gate fails, fix the code or restore the
  test — do not lower thresholds, widen ignores, or skip the gate.

When in doubt, prefer the smallest change that keeps all gates green.
