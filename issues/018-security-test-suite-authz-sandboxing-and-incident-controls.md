# Build security test suite for auth, sandboxing, and incident controls

## Summary
Implement dedicated security regression tests covering authentication, authorization, input validation, plugin sandboxing, network controls, exec policy, and incident response paths.

## Scope
- AuthN/AuthZ tests for HMAC, nonce replay, token expiry, and RBAC matrix
- Input validation tests for traversal/symlink/session identifier hardening
- Network tests for origin allowlist, rate limits, and frame caps
- Plugin security tests for permission enforcement and privileged hooks
- Exec approval tests for allow/deny precedence and audit integrity
- Device revoke immediate disconnect behavior tests

## Acceptance Criteria
- Every security scenario in the spec has automated coverage
- Failing a security invariant blocks CI
- Audit log assertions verify actor/timestamp/outcome presence

## Dependencies
- #003
- #004
- #005
- #011
- #014
- #015

## Suggested Labels
- `type:test`
- `area:security`
- `priority:p0`

## Source
- `docs/plan.combined.md` (Security Considerations, Test Cases)
