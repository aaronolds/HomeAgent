# Persistence: Append-Only Audit Log

## Overview
Implement the immutable, append-only audit log at `~/.homeagent/audit.jsonl` that records all security-relevant events. This provides forensic traceability for authentication, authorization, execution, and plugin lifecycle events.

## Scope

**Included:**
- Append-only JSONL audit log at `~/.homeagent/audit.jsonl`
- Structured audit event schema with: actor, timestamp, event type, outcome, metadata
- Event types: auth attempts (success/failure), device approvals/rejections/revocations, exec-approval state changes, RPC access denials, plugin lifecycle events, file access violations
- Sensitive data redaction: prompts, tool args, tokens, API keys stripped by default via pino redaction paths
- Log rotation support (configurable max size, rotate to `audit.<timestamp>.jsonl`)
- Reader utility for `audit tail` CLI support (see #025)
- File permissions `0600`

**Excluded:**
- CLI commands (see #025)
- Plugin monitoring hooks (future)
- Alerting/notification on audit events (future)

## Technical Requirements

### Audit Event Schema
```typescript
import { z } from 'zod';

export const AuditEventType = z.enum([
  'auth.connect.success',
  'auth.connect.failure',
  'auth.nonce.replayed',
  'auth.token.expired',
  'device.approved',
  'device.rejected',
  'device.revoked',
  'rbac.denied',
  'rpc.rate_limited',
  'exec.requested',
  'exec.approved',
  'exec.denied',
  'exec.completed',
  'plugin.loaded',
  'plugin.disabled',
  'plugin.permission_denied',
  'file.access_denied',
  'file.traversal_blocked',
  'session.created',
  'session.killed',
  'secret.rotated',
]);

export const AuditEvent = z.object({
  ts: z.number(),
  type: AuditEventType,
  actor: z.object({
    deviceId: z.string().optional(),
    connectionId: z.string().optional(),
    agentId: z.string().optional(),
    role: z.string().optional(),
    ip: z.string().optional(),
  }),
  outcome: z.enum(['success', 'failure', 'denied', 'error']),
  details: z.record(z.unknown()).optional(),
});
```

### Audit Logger API
```typescript
class AuditLogger {
  constructor(private logPath: string) {}

  async log(event: AuditEvent): Promise<void>;
  async tail(count: number): Promise<AuditEvent[]>;
  async query(filter: { type?: string; actor?: string; since?: number }): AsyncIterable<AuditEvent>;
  
  // Rotation
  private async rotateIfNeeded(): Promise<void>;
}
```

### Redaction
```typescript
// Redact sensitive fields before writing to audit log
const REDACTED_FIELDS = ['authToken', 'sessionToken', 'sharedSecret', 'apiKey', 'prompt', 'toolArgs'];

function redactEvent(event: AuditEvent): AuditEvent {
  // Deep clone and strip sensitive fields from details
}
```

## Implementation Plan

1. Define `AuditEvent` Zod schema in `packages/shared/src/schemas/audit.ts`
2. Create `packages/gateway/src/audit/logger.ts` — append-only JSONL writer
3. Implement `log()` with redaction, `O_APPEND`, and `fsync`
4. Implement `tail()` — read last N lines efficiently
5. Implement `query()` — filtered async iterator over the log
6. Implement log rotation: check size before write, rotate if exceeded
7. Set file permissions to `0600`
8. Integrate audit logger into gateway lifecycle:
   - Auth handler: log connect success/failure
   - RBAC middleware: log denials
   - Rate limiter: log rate limit events
   - Connection manager: log device approvals/revocations
9. Write tests:
   - Event is appended correctly
   - Sensitive data is redacted
   - `tail()` returns correct last N events
   - `query()` filters by type and time range
   - Log rotation triggers at configured size
   - File has `0600` permissions
   - Concurrent writes are safe

## Acceptance Criteria
- [ ] Audit events are appended to `~/.homeagent/audit.jsonl`
- [ ] Each event includes actor, timestamp, type, and outcome
- [ ] Sensitive data (tokens, secrets, prompts, tool args) is redacted
- [ ] `tail()` efficiently reads last N events
- [ ] `query()` filters by event type, actor, and time range
- [ ] Log rotation works at configurable size threshold
- [ ] File permissions are `0600`
- [ ] Writes are crash-safe (`O_APPEND` + `fsync`)
- [ ] All security-relevant gateway events are logged
- [ ] All tests pass

## Priority
**High** — audit trail is required for security compliance and incident response.

**Scoring:**
- User Impact: 4 (security/compliance)
- Strategic Alignment: 5 (security is core)
- Implementation Feasibility: 4 (JSONL writing is simple)
- Resource Requirements: 2 (moderate)
- Risk Level: 1 (low)
- **Score: 10.0**

## Dependencies
- **Blocks:** #025 (audit tail CLI)
- **Blocked by:** #002, #004

## Implementation Size
- **Estimated effort:** Medium (2-3 days)
- **Labels:** `enhancement`, `high-priority`, `phase-4`, `persistence`, `security`, `audit`
