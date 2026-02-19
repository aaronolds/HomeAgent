# Define shared protocol schemas and typed contracts

## Summary

Implement shared Zod schemas for handshake, RPC envelopes, events, method payloads, and versioned compatibility fields.

## Scope

- Add handshake schemas (`connect`, `connect_ok`, `error`)
- Add RPC request/response/event envelopes with `version`
- Enforce idempotency key requirement on side-effecting methods
- Export JSON Schema from Zod contracts

## Acceptance Criteria

- All core method payloads have Zod schemas and inferred TS types
- JSON Schema artifacts are generated and versioned
- Envelope validation rejects malformed payloads with typed errors
- Compatibility/version field present in every envelope

## Dependencies

- #001

## Suggested Labels

- `type:feature`
- `area:shared`
- `priority:p0`

## Source

- `docs/plan.combined.md` (Public Interfaces, Phase 2)
