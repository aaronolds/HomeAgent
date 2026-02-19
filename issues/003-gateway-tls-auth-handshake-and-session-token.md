# Build gateway TLS handshake, auth, and session token flow

## Summary

Implement Fastify + WebSocket connection flow with TLS-by-default, HMAC device authentication, nonce replay protection, and short-lived session tokens.

## Scope

- WebSocket over TLS by default (self-signed onboarding cert + user cert support)
- Optional plaintext only via explicit `--insecure`
- Validate HMAC auth token (`deviceId + nonce + timestamp`)
- Reject replayed nonce values in configurable window
- Reject unapproved devices at connect
- Issue and refresh short-lived `sessionToken`

## Acceptance Criteria

- Invalid HMAC/nonce/timestamp connections are rejected
- Replayed nonce is rejected and audited
- Unapproved devices cannot establish session
- Session token is issued on connect and refreshed on heartbeat

## Dependencies

- #001
- #002

## Suggested Labels

- `type:feature`
- `area:gateway`
- `area:security`
- `priority:p0`

## Source

- `docs/plan.combined.md` (Phase 3, Security Considerations)
