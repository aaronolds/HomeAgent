# Build core test suite: protocol, runtime, persistence, and e2e

## Summary
Implement comprehensive non-security test coverage for protocol correctness, idempotency, concurrency, persistence integrity, multi-agent routing, and e2e flows.

## Scope
- Protocol validation tests for malformed input and unknown methods
- Idempotency consistency and restart-recovery behavior
- Session concurrency and serialization tests
- Persistence integrity tests for JSONL/SQLite transactions
- End-to-end flow: provider inbound -> runtime -> outbound

## Acceptance Criteria
- Vitest suite covers all listed scenarios with deterministic assertions
- CI gate fails on regressions in protocol/runtime invariants
- E2E smoke run validates first-provider round trip

## Dependencies
- #004
- #006
- #008
- #009
- #012

## Suggested Labels
- `type:test`
- `area:quality`
- `priority:p0`

## Source
- `docs/plan.combined.md` (Test Cases and Scenarios)
