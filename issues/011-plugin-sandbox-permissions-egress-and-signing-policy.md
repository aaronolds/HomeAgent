# Enforce plugin sandbox, permissions, egress controls, and signing policy

## Summary
Implement security model for built-in vs third-party plugins, including manifest permissions, child-process sandboxing, privileged hook controls, and optional signature verification.

## Scope
- Plugin trust tiers and manifest schema
- Child-process loading for third-party plugins with Node permission flags
- Permission gate checks (`fs_read`, `fs_write`, `network`, `exec`, `privileged_hooks`)
- Network egress disabled by default unless declared + allowlisted
- Unsiged plugin confirmation flow and signature verification path

## Acceptance Criteria
- Undeclared capability access is blocked and audited
- Plugins without `privileged_hooks` cannot register privileged hooks
- Third-party plugins without network permission cannot call outbound hosts
- Unsigned install requires explicit confirmation

## Dependencies
- #010
- #006

## Suggested Labels
- `type:feature`
- `area:plugins`
- `area:security`
- `priority:p0`

## Source
- `docs/plan.combined.md` (Phase 7, Plugin Security)
