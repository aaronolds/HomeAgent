# Implement RPC router, RBAC enforcement, and idempotency middleware

## Summary

Create RPC routing for core methods with strict role checks and durable idempotency behavior for side-effecting calls.

## Scope

- Implement core RPC methods from v1 list
- Enforce RBAC matrix for `client`, `node`, `admin`
- Require idempotency key for side-effecting methods
- Namespace keys as `deviceId + method + key`
- Persist key state in SQLite with TTL expiration

## Acceptance Criteria

- Unauthorized role calls are denied with typed errors
- Missing idempotency keys on side-effecting methods are rejected
- Duplicate idempotent call returns consistent result
- Router supports `device.revoke` and `plugin.disable` admin operations

## Dependencies

- #002
- #003

## Suggested Labels

- `type:feature`
- `area:gateway`
- `area:security`
- `priority:p0`

## Source

- `docs/plan.combined.md` (Public Interfaces, Phase 3)
