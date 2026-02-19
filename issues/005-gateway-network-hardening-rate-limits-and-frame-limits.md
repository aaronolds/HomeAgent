# Add gateway network hardening, rate limits, and frame size limits

## Summary

Harden gateway network behavior with origin validation, strict endpoint policy, and layered rate/size controls.

## Scope

- Validate `Origin` on WebSocket upgrade with allowlist
- Define strict CORS policy for HTTP endpoints
- Add per-IP connection rate limits
- Add per-device RPC and `agent.run` limits
- Reject oversized WebSocket frames (default 1MB)

## Acceptance Criteria

- Non-allowlisted origins are rejected
- Exceeded limits return `429` and deny processing
- Oversized frames are rejected with typed error
- Config knobs available through config package

## Dependencies

- #003
- #004

## Suggested Labels

- `type:feature`
- `area:gateway`
- `area:security`
- `priority:p1`

## Source

- `docs/plan.combined.md` (Phase 3, Network Security)
