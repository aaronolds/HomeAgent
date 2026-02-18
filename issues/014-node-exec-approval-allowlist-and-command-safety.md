# Implement exec approval allowlist and safe command execution

## Summary
Deliver scoped command approval policy for node execution requests with deny precedence, strict arg handling, and full auditing.

## Scope
- JSON allowlist/deny policy schema for commands + args + cwd
- Policy engine with deny-overrides-allow behavior
- Execute commands using `execFile` with arg arrays only
- Audit every exec request, decision, and result

## Acceptance Criteria
- Commands outside allowlist are rejected
- Deny patterns override matching allow patterns
- No shell interpolation path exists
- Audit entries contain requester, command, args, exit code, outcome

## Dependencies
- #013
- #006

## Suggested Labels
- `type:feature`
- `area:node`
- `area:security`
- `priority:p0`

## Source
- `docs/plan.combined.md` (Phase 8, Exec Approval Security)
