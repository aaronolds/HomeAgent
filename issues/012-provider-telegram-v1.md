# Implement Telegram provider (v1)

## Summary
Ship first messaging provider with auth, inbound parsing, and outbound formatting integrated with runtime bindings.

## Scope
- Telegram provider module with auth/config handling
- Inbound message normalization to internal event model
- Outbound message formatting and send path
- Integration with binding router to select target agent

## Acceptance Criteria
- Inbound Telegram message triggers runtime flow for bound agent
- Outbound runtime response is sent via Telegram provider
- Provider errors are surfaced with typed retries where applicable

## Dependencies
- #009
- #016

## Suggested Labels
- `type:feature`
- `area:providers`
- `priority:p1`

## Source
- `docs/plan.combined.md` (Phase 8)
