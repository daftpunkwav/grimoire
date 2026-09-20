# Add a package

> Language: **English** | [简体中文](add-a-package.zh.md)

When a capability is reusable across two or more services **and** cannot
be expressed as a port inside an existing service, it gets its own
package. This guide spells out the package anatomy, the registration
step, and the boundary rules.

## When to add a package

Add a package when **both** of the following hold:

- At least two consumers (services or other packages) need the same
  capability.
- The capability cannot be expressed as a cross-service port surface
  (see [add-a-service.md](./add-a-service.md)).

If the capability is used by exactly one consumer, **do not** add a
package. Put it inside the consumer.

If the capability is genuinely cross-service but the surface is a port,
**do not** add a package. Declare the port in
`@grimoire/contracts`.

## Layout

```
packages/<name>/
  package.json             # name: @grimoire/<name>, private: true
  tsconfig.json            # extends the repo base
  README.md                # responsibilities, seam surface, dep direction
  README.zh.md             # mirror in Simplified Chinese
  src/
    index.ts               # barrel: public exports
    <module>.ts            # one file per cohesive capability
  tests/
    <module>.test.ts       # co-located unit tests
```

## `package.json` contract

Same shape as a service (see [add-a-service.md](./add-a-service.md)).
Differences:

- `name` follows `@grimoire/<name>` (singular, lowercase, kebab-case
  allowed).
- `dependencies` are limited to:
  - `@grimoire/contracts` (always allowed).
  - `bcryptjs`, `express`, `jsonwebtoken`, `pino`, `zod`,
    `@prisma/client` (for `packages/foundation` only; other packages
    do not depend on these).
  - First-party LLM / auth libraries only when the package genuinely
    needs them.

The CI gate `pnpm check:deps` enforces declared-vs-imported honesty and
rejects value / dynamic dependency cycles.

## Boundary rules (enforced)

- A package may not import from `apps/`.
- A package may not import from another service's source — only from
  that service's `src/index.ts`, and only when the package's
  `package.json` declares the dependency.
- `packages/contracts` depends on nothing in this repo. Any package
  that imports a service is rejected by `pnpm boundaries`.

## Adding a port surface

If the new package exposes new port interfaces, declare them in
`packages/contracts/src/ports.ts` (do not define them in the new
package itself). The implementation lives in the new package; the
interface lives in contracts.

## PR checklist

- [ ] `packages/<name>/` ships the implementation + tests + READMEs.
- [ ] `packages/<name>/package.json` declares every dep it imports.
- [ ] Every consumer's `package.json` declares `@grimoire/<name>`
      under `dependencies` (or `devDependencies` for type-only use).
- [ ] `pnpm verify` is green locally.
- [ ] `pnpm boundaries` is green locally.
- [ ] `pnpm check:deps` is green locally.
- [ ] `pnpm check:exports` is green locally.
