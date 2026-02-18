# Initialize Monorepo & Root Tooling Configuration

## Overview
Set up the foundational monorepo structure for HomeAgent using pnpm workspaces with TypeScript, Biome, and Vitest. This is the absolute first step — every other issue depends on it.

## Scope

**Included:**
- Root `package.json` with workspace scripts (`dev`, `test`, `lint`, `build`)
- `pnpm-workspace.yaml` pointing to `packages/*` and `packages/providers/*`
- Base `tsconfig.json` with strict mode (ESM, ES2022 target)
- `biome.json` with default linting and formatting rules
- `.gitignore` (node_modules, dist, .homeagent, coverage, etc.)
- Verify `pnpm install` succeeds from clean state

**Excluded:**
- Individual package contents (handled in subsequent issues)
- CI/CD pipeline setup (future issue)

## Technical Requirements

### Root `package.json`
```jsonc
{
  "name": "homeagent",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "packageManager": "pnpm@9.x",
  "scripts": {
    "dev": "pnpm --filter @homeagent/gateway dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "biome check .",
    "lint:fix": "biome check --write ."
  }
}
```

### `pnpm-workspace.yaml`
```yaml
packages:
  - 'packages/*'
  - 'packages/providers/*'
```

### Base `tsconfig.json`
```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noImplicitAny": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "skipLibCheck": true
  }
}
```

### `biome.json`
- Enable linter and formatter
- Organize imports
- Indent: 2 spaces, line width: 100

## Implementation Plan

1. Create root `package.json` with workspace config and scripts
2. Create `pnpm-workspace.yaml`
3. Create base `tsconfig.json` with strict settings
4. Create `biome.json`
5. Update `.gitignore` for Node.js, TypeScript, editor files, and `.homeagent/`
6. Run `pnpm install` and verify it succeeds
7. Run `biome check .` and verify it passes

## Acceptance Criteria
- [ ] `pnpm install` succeeds from a clean clone
- [ ] `biome check .` passes with no errors
- [ ] `tsconfig.json` has strict mode enabled with all specified flags
- [ ] `pnpm-workspace.yaml` correctly declares the package globs
- [ ] Root scripts (`dev`, `test`, `lint`, `build`) are defined
- [ ] Node.js 22 LTS is declared as the minimum engine version
- [ ] ESM is enforced (`"type": "module"`)

## Priority
**Critical** — this is the absolute prerequisite for all other work.

**Scoring:**
- User Impact: 5 (enables all development)
- Strategic Alignment: 5 (foundational)
- Implementation Feasibility: 5 (straightforward)
- Resource Requirements: 1 (minimal effort)
- Risk Level: 1 (low risk)
- **Score: 25.0**

## Dependencies
- **Blocks:** #002, #003, #004, and transitively all other issues
- **Blocked by:** None

## Implementation Size
- **Estimated effort:** Small (< 1 day)
- **Labels:** `enhancement`, `high-priority`, `phase-1`, `scaffold`
