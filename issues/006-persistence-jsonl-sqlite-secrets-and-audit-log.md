# Build persistence layer: JSONL, SQLite, secrets, and audit log

## Summary

Implement authoritative JSONL transcripts plus SQLite operational state, encrypted secrets storage, and append-only audit logging.

## Scope

- JSONL transcript writer per session path
- SQLite indexes for devices, approvals, idempotency, registry with WAL and permissions
- Transaction support for side-effecting RPCs
- Secrets storage via keychain or master-passphrase encryption
- Append-only `audit.jsonl` with redaction defaults

## Acceptance Criteria

- Transcript writes are append-only and recoverable after crash
- SQLite rollback works on failure paths
- Secrets never persisted as plaintext
- Security-relevant events written to audit log with actor/timestamp/outcome

## Dependencies

- #001
- #004

## Suggested Labels

- `type:feature`
- `area:persistence`
- `area:security`
- `priority:p0`

## Source

- `docs/plan.combined.md` (Phase 4)
