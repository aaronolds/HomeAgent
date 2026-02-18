# Implement multi-agent registry, bindings, and isolation

## Summary
Enable multi-agent operation with per-agent workspace/state, inbound binding routes, and cross-agent isolation guarantees.

## Scope
- Agent registry with isolated config/state
- Per-agent workspace directories and session partitioning
- Binding system for provider channel/sender routing
- Isolation checks preventing cross-agent file/state access

## Acceptance Criteria
- Messages route to correct agent by binding
- One agent cannot access another agent’s workspace or sessions
- Registry supports per-agent skill/config references

## Dependencies
- #006
- #007

## Suggested Labels
- `type:feature`
- `area:runtime`
- `priority:p1`

## Source
- `docs/plan.combined.md` (Phase 6)
