# Build CLI onboarding and operator workflows

## Summary
Implement onboarding and operator command surface for runtime control and incident response.

## Scope
- Onboarding wizard (agent creation, provider creds, node pairing)
- CLI commands: `send`, `agent run`, `status`, `sessions`, `approvals`, `diagnostics`
- Incident commands: `device revoke`, `plugin disable`, `sessions kill`, `audit tail`, `secrets rotate`

## Acceptance Criteria
- Onboarding can configure first working agent + provider
- Runtime command set works end-to-end with gateway
- Incident response commands enforce RBAC and produce audit records

## Dependencies
- #004
- #006
- #012
- #013

## Suggested Labels
- `type:feature`
- `area:cli`
- `priority:p1`

## Source
- `docs/plan.combined.md` (Phase 9)
