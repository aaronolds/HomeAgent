# Implement runtime session locking, context assembly, and compaction

## Summary
Build serialized runtime loop behavior per session with bootstrap injection, workspace reload, token budgeting, and transcript compaction.

## Scope
- Session lock manager keyed by `agentId + sessionId`
- First-turn bootstrap file injection (`AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`)
- Workspace file reload each turn
- Token budget accounting and compaction trigger threshold
- Rolling summary compaction into `<sessionId>.compacted.jsonl`

## Acceptance Criteria
- Same-session runs are serialized; different sessions can run concurrently
- Recent turns stay verbatim; older turns compacted when threshold exceeded
- Compaction executes at context assembly start, not mid-turn
- Context boundaries for user content are clearly delimited

## Dependencies
- #002
- #006

## Suggested Labels
- `type:feature`
- `area:runtime`
- `priority:p0`

## Source
- `docs/plan.combined.md` (Phase 5)
