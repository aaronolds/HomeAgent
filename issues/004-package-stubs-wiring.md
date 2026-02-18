# Remaining Package Stubs & Cross-Package Import Wiring

## Overview
Create minimal package scaffolds for all remaining packages in the monorepo: `runtime`, `tools`, `plugins`, `cli`, `node`, `skills`, `config`, and provider stubs (`telegram`, `whatsapp`, `slack`, `discord`). Wire up pnpm workspace protocol imports to verify cross-package resolution works end-to-end.

## Scope

**Included:**
- Minimal `package.json` + `tsconfig.json` + `src/index.ts` for each package
- All packages use `workspace:*` to declare internal dependencies
- Each package exports at least a placeholder (e.g., `export const VERSION = '0.0.0';`)
- A trivial Vitest test per package that imports from `@homeagent/shared`
- Provider stubs under `packages/providers/{telegram,whatsapp,slack,discord}`

**Excluded:**
- Actual implementation of any package (handled in dedicated issues)
- Only structural scaffolding

## Technical Requirements

### Packages to Create
| Package | Path | Key Dependencies |
|---|---|---|
| `@homeagent/runtime` | `packages/runtime` | `@homeagent/shared` |
| `@homeagent/tools` | `packages/tools` | `@homeagent/shared`, `@homeagent/runtime` |
| `@homeagent/plugins` | `packages/plugins` | `@homeagent/shared` |
| `@homeagent/cli` | `packages/cli` | `@homeagent/shared`, `@homeagent/gateway` |
| `@homeagent/node` | `packages/node` | `@homeagent/shared` |
| `@homeagent/skills` | `packages/skills` | `@homeagent/shared`, `@homeagent/tools` |
| `@homeagent/config` | `packages/config` | `@homeagent/shared` |
| `@homeagent/provider-telegram` | `packages/providers/telegram` | `@homeagent/shared` |
| `@homeagent/provider-whatsapp` | `packages/providers/whatsapp` | `@homeagent/shared` |
| `@homeagent/provider-slack` | `packages/providers/slack` | `@homeagent/shared` |
| `@homeagent/provider-discord` | `packages/providers/discord` | `@homeagent/shared` |

### Minimal Package Template
```jsonc
// packages/<name>/package.json
{
  "name": "@homeagent/<name>",
  "version": "0.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run"
  },
  "dependencies": {
    "@homeagent/shared": "workspace:*"
  }
}
```

## Implementation Plan

1. Create a script or manually scaffold each package with `package.json`, `tsconfig.json`, and `src/index.ts`
2. Add `vitest` as a root dev dependency
3. Create a minimal test file per package (`src/__tests__/index.test.ts`) that imports from `@homeagent/shared`
4. Run `pnpm install` to verify workspace resolution
5. Run `pnpm -r build` to verify all packages compile
6. Run `pnpm -r test` to verify imports resolve across packages

## Acceptance Criteria
- [ ] All 11 packages listed above exist with valid `package.json`, `tsconfig.json`, and `src/index.ts`
- [ ] `pnpm install` succeeds and resolves all `workspace:*` dependencies
- [ ] `pnpm -r build` compiles all packages without errors
- [ ] `pnpm -r test` passes trivial import tests in all packages
- [ ] Each package can import types from `@homeagent/shared`
- [ ] Provider packages are under `packages/providers/` and detected by the workspace glob

## Priority
**High** — unblocks parallel development across all packages.

**Scoring:**
- User Impact: 4 (enables all feature work)
- Strategic Alignment: 5 (monorepo architecture)
- Implementation Feasibility: 5 (mechanical work)
- Resource Requirements: 2 (repetitive but straightforward)
- Risk Level: 1 (low risk)
- **Score: 10.0**

## Dependencies
- **Blocks:** #010, #011, #012, #013, #014, #019, #020, #021, #022, #023, #024, #025
- **Blocked by:** #001, #002

## Implementation Size
- **Estimated effort:** Small–Medium (1-2 days)
- **Labels:** `enhancement`, `high-priority`, `phase-1`, `scaffold`
