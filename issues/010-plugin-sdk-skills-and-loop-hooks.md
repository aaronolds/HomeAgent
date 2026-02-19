# Deliver plugin SDK, skills package, and loop hook integration

## Summary

Implement public plugin SDK surface and built-in skills packaging with runtime hook registration and lifecycle management.

## Scope

- Skills package for prompt + tool bundles
- SDK APIs: register tool, RPC, provider, background service, CLI command, loop hook
- Hook lifecycle points (`onIntake`, `onContextAssembled`, `onModelResponse`, `onToolResult`, `onTurnComplete`)
- Registration ordering and error handling semantics

## Acceptance Criteria

- Plugins can dynamically register all declared extension points
- Hook execution order is deterministic
- Lifecycle hooks (`init`, `start`, `stop`) work for background services
- SDK versioning (`sdkApiVersion`) is exposed

## Dependencies

- #007
- #008

## Suggested Labels

- `type:feature`
- `area:plugins`
- `priority:p1`

## Source

- `docs/plan.combined.md` (Phase 7)
