# Add a service

> Language: **English** | [简体中文](add-a-service.zh.md)

When a new business domain cannot be expressed as a port + implementation
pair inside an existing service, it gets its own workspace. This guide
spells out the seams, the registration step, and the boundary rules.

## When to add a service

Add a service when **all** of the following hold:

- The capability owns its own bounded context (its own data model
  slice, its own lifecycle, its own RBAC slice).
- At least one other service needs to depend on a port surface this
  domain exposes, **and** that surface cannot be expressed as a port
  inside the depending service.
- The capability needs its own `routes/`, `services/`, and `lib/`
  layout — a single file is not enough.

If any condition fails, **do not** add a service. Add a port to an
existing service, or split an existing service. See
[architecture/decision-register.md](../architecture/decision-register.md)
for the iron rules.

## Layout

```
services/<domain>/
  package.json             # name: @grimoire/<domain>, private: true
  tsconfig.json            # extends the repo base
  README.md                # responsibilities, seam surface, dep direction
  README.zh.md             # mirror in Simplified Chinese
  src/
    index.ts               # barrel: public exports (port impls + helpers)
    repositories.ts        # any repositories owned by this domain
    serialize.ts           # request / response DTO mappers
    routes/
      <feature>.ts         # Express route modules
    services/
      <use-case>.ts        # application-layer use cases
    lib/
      <helpers>.ts         # internal helpers
  tests/
    <feature>.test.ts      # co-located unit / integration tests
```

## Required seams

A new service must:

1. **Expose at least one port** declared in
   [`packages/contracts/src/ports.ts`](../../packages/contracts/src/ports.ts).
2. **Implement that port** in `src/index.ts` (or a dedicated module
   re-exported from there).
3. **Register the implementation** in
   [`apps/api/src/compose.ts`](../../apps/api/src/compose.ts) inside the
   matching `compose()` step.
4. **Add at least one test** for every route and every port method.
   The CI gate `pnpm check:exports` enforces export coverage; the
   gate `pnpm boundaries` enforces that routes consume only ports.

## Boundary rules (enforced)

- The new service may depend on `@grimoire/contracts`,
  `@grimoire/foundation`, and `@grimoire/llm` (for prompt assembly
  only).
- The new service **must not** import another service's source.
- The new service's routes **must not** import the composition root.
- The new service **must not** own provider credentials; it reads
  decrypted keys through the `LlmKeyAccess` port.

## `package.json` contract

```json
{
  "name": "@grimoire/<domain>",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit",
    "lint": "oxlint src",
    "test": "vitest run"
  }
}
```

## Composition root update

Add a new step in `compose()`:

```ts
import { createFooService } from "@grimoire/<domain>";

export function compose(...): RuntimeComponents {
  // ... existing steps ...
  const foo = createFooService({ logger, prisma });
  return { /* ... */, foo };
}
```

Add a mount in `app.ts` (or whichever file calls
`mountFooRoutes(app, foo)`), then add an integration test in
`apps/api/tests/` that exercises the new route.

## PR checklist

- [ ] `packages/contracts` declares the new port (or extends an
      existing one).
- [ ] `services/<domain>/` ships the implementation + tests + READMEs.
- [ ] `apps/api/src/compose.ts` registers the implementation.
- [ ] `apps/api/src/app.ts` mounts the route.
- [ ] `pnpm verify` is green locally.
- [ ] `pnpm boundaries` is green locally.
- [ ] `pnpm check:exports` is green locally.
