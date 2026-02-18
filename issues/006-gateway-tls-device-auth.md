# Gateway: Device Authentication, TLS & Pairing

## Overview
Implement TLS support and device authentication for the gateway. Every connecting client or node must authenticate via HMAC-signed challenge during the WebSocket handshake. New devices must be paired and approved before they can connect. This is the core security gate for the entire system.

## Scope

**Included:**
- TLS support via Fastify's native HTTPS options
- Self-signed certificate generation during onboarding (CLI helper)
- User-provided certificate support
- `--insecure` flag for local-only development (plaintext mode)
- HMAC authentication: validate `authToken = HMAC(deviceId + nonce + timestamp, sharedSecret)`
- Nonce replay protection with sliding window (configurable, default 5 minutes)
- Device pairing: store shared secrets during pairing, look up on connect
- Session token issuance on successful connect
- Reject unapproved devices at connect with `DEVICE_NOT_APPROVED` error
- Reject invalid/expired auth with `AUTH_FAILED` error
- WebSocket `Origin` header validation

**Excluded:**
- RBAC role enforcement (see #007)
- Session token refresh on heartbeat (see #009)
- Full pairing CLI workflow (see #024)

## Technical Requirements

### HMAC Authentication
```typescript
import { createHmac, timingSafeEqual } from 'node:crypto';

function validateAuthToken(
  deviceId: string,
  nonce: string,
  timestamp: number,
  authToken: string,
  sharedSecret: string,
): boolean {
  const expected = createHmac('sha256', sharedSecret)
    .update(`${deviceId}${nonce}${timestamp}`)
    .digest('hex');
  return timingSafeEqual(Buffer.from(authToken), Buffer.from(expected));
}
```

### Nonce Replay Protection
- Store used nonces in a Map or SQLite with TTL-based expiry
- Reject any nonce seen within the sliding window
- Nonce window configurable (default: 300 seconds)

### TLS Setup
```typescript
import { readFileSync } from 'node:fs';

const server = Fastify({
  https: insecure ? undefined : {
    key: readFileSync(config.tlsKeyPath),
    cert: readFileSync(config.tlsCertPath),
  },
});
```

### Origin Validation
- Check `Origin` header on WebSocket upgrade request
- Reject connections from origins not in the allowlist
- Allowlist configurable; default: reject all browser origins (CLI/node clients don't send Origin)

## Implementation Plan

1. Add TLS option to Fastify server factory with cert/key paths from config
2. Implement self-signed cert generation utility using `node:crypto`
3. Add `--insecure` flag to skip TLS
4. Implement HMAC validation function with timing-safe comparison
5. Implement nonce store with TTL expiry (in-memory for now; SQLite in #011)
6. Add device lookup: query stored shared secret by `deviceId`
7. Add approval check: reject unapproved devices
8. Issue opaque session tokens on successful auth (random UUID, stored in memory)
9. Add Origin header check on WebSocket upgrade
10. Write tests:
    - Valid HMAC + fresh nonce → `connect_ok`
    - Invalid HMAC → `AUTH_FAILED`
    - Replayed nonce → `NONCE_REUSED`
    - Unapproved device → `DEVICE_NOT_APPROVED`
    - Rejected origin → `ORIGIN_REJECTED`
    - TLS server starts with valid certs
    - `--insecure` mode works without certs

## Acceptance Criteria
- [ ] Gateway serves WebSocket over TLS by default
- [ ] Self-signed cert generation works for development
- [ ] `--insecure` flag enables plaintext mode
- [ ] Valid HMAC + fresh nonce authenticates successfully
- [ ] Invalid HMAC is rejected with `AUTH_FAILED`
- [ ] Replayed nonce is rejected with `NONCE_REUSED`
- [ ] Unapproved device is rejected with `DEVICE_NOT_APPROVED`
- [ ] Session token is issued on successful connect
- [ ] Non-allowlisted Origin is rejected
- [ ] Timing-safe comparison used for all secret comparisons
- [ ] All auth tests pass

## Priority
**Critical** — no client or node can connect without authentication.

**Scoring:**
- User Impact: 5 (security is non-negotiable)
- Strategic Alignment: 5 (core security requirement)
- Implementation Feasibility: 4 (crypto APIs well-documented)
- Resource Requirements: 3 (moderate complexity)
- Risk Level: 2 (security-sensitive code)
- **Score: 4.2**

## Dependencies
- **Blocks:** #007, #008, #009, #023, #024
- **Blocked by:** #002, #003

## Implementation Size
- **Estimated effort:** Medium–Large (3-4 days)
- **Labels:** `enhancement`, `high-priority`, `phase-3`, `gateway`, `security`
