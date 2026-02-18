# Build node host secure connect, capability publish, and browser proxy

## Summary
Implement node host role behavior including secure gateway pairing/auth, capability advertisement, and browser proxy support.

## Scope
- Node host connect flow with `role: node` and HMAC auth
- Capability publication model (exec/canvas/camera/location)
- Browser proxy publishing for browsing tasks
- Restrict node role from initiating prohibited RPC methods

## Acceptance Criteria
- Node connection succeeds only with valid auth and approval
- Node capabilities visible to gateway/runtime
- Browser proxy route is available and policy-controlled
- Node role RBAC restrictions are enforced

## Dependencies
- #003
- #004

## Suggested Labels
- `type:feature`
- `area:node`
- `priority:p1`

## Source
- `docs/plan.combined.md` (Phase 8)
