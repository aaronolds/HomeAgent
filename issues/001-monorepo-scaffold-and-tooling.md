# Scaffold monorepo and baseline tooling

## Summary
Initialize the HomeAgent TypeScript monorepo with pnpm workspaces, strict TS, Biome, and package stubs required for v1.

## Scope
- Create root: `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `biome.json`, `.gitignore`
- Create package stubs under `packages/` per spec
- Configure workspace scripts: `dev`, `test`, `lint`, `build`
- Ensure ESM-only package setup

## Acceptance Criteria
- `pnpm install` succeeds from repo root
- `pnpm test` executes trivial tests successfully across packages
- `biome check .` passes
- All planned packages exist with minimal `package.json`, `tsconfig.json`, and `src/index.ts`

## Dependencies
- None

## Suggested Labels
- `type:feature`
- `area:build`
- `priority:p0`

## Source
- `docs/plan.combined.md` (Phase 1)
