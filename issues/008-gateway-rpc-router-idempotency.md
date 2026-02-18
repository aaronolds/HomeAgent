# Gateway: RPC Router & Idempotency Middleware

## Overview
Implement the RPC router that dispatches incoming WebSocket messages to the correct method handler, and the idempotency middleware that prevents duplicate execution of side-effecting methods. This is the core dispatch layer all RPC calls flow through.

## Scope

**Included:**
- RPC router: parse incoming `RpcRequest`, resolve handler by `method`, dispatch with validated params
- Handler registration: typed handler map keyed by method name
- Idempotency middleware for side-effecting methods (`message.send`, `agent.run`, `node.exec.request`, `node.exec.approve`, `device.revoke`, `plugin.disable`)
- Idempotency key namespacing: `deviceId + method + key`
- Idempotency key storage in SQLite with TTL-based expiry (default 24h)
- Reject side-effecting calls without `idempotencyKey` with `IDEMPOTENCY_KEY_REQUIRED`
- Return cached result for duplicate keys with `IDEMPOTENCY_KEY_CONFLICT` status
- Per-method Zod schema validation of params before handler invocation
- Typed `RpcResponse` on success, typed error on failure

**Excluded:**
- Specific method implementations (handlers registered by other packages)
- RBAC check (see #007 — runs before routing)
- Event broadcasting (see #009)

## Technical Requirements

### Router Structure
```typescript
type RpcHandler<P, R> = (params: P, context: RpcContext) => Promise<R>;

interface RpcContext {
  connectionId: string;
  deviceId: string;
  role: 'client' | 'node' | 'admin';
  agentId?: string;
}

class RpcRouter {
  private handlers = new Map<string, { schema: ZodSchema; handler: RpcHandler<any, any> }>();

  register<P, R>(method: string, schema: ZodSchema<P>, handler: RpcHandler<P, R>): void;
  
  async dispatch(request: RpcRequest, context: RpcContext): Promise<RpcResponse>;
}
```

### Idempotency Middleware
```typescript
interface IdempotencyRecord {
  key: string;         // deviceId + method + idempotencyKey
  result: unknown;     // cached response
  createdAt: number;
  expiresAt: number;
}

// Flow:
// 1. Check if method is side-effecting
// 2. If yes, require idempotencyKey
// 3. Compute namespaced key
// 4. Look up in SQLite
// 5. If found and not expired: return cached result
// 6. If not found: execute handler, store result, return
```

### SQLite Schema for Idempotency
```sql
CREATE TABLE idempotency_keys (
  key TEXT PRIMARY KEY,
  method TEXT NOT NULL,
  device_id TEXT NOT NULL,
  result TEXT NOT NULL,  -- JSON serialized
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);
```

## Implementation Plan

1. Create `packages/gateway/src/rpc/router.ts` — router class with handler registration
2. Create `packages/gateway/src/rpc/types.ts` — handler types and context
3. Create `packages/gateway/src/middleware/idempotency.ts` — idempotency check/store logic
4. Create idempotency SQLite table (or use in-memory store for tests)
5. Wire router into WebSocket message handler: parse → RBAC → idempotency → dispatch → respond
6. Add per-method schema validation using schemas from `@homeagent/shared`
7. Add TTL-based cleanup job for expired idempotency keys (periodic timer)
8. Write tests:
   - Valid RPC dispatches to correct handler
   - Invalid params return `INVALID_PARAMS`
   - Unknown method returns `METHOD_NOT_FOUND`
   - Side-effecting call without `idempotencyKey` returns `IDEMPOTENCY_KEY_REQUIRED`
   - Duplicate `idempotencyKey` returns cached result
   - Expired idempotency key allows re-execution
   - Idempotency keys are namespaced per device+method

## Acceptance Criteria
- [ ] Router dispatches RPC calls to registered handlers
- [ ] Params are validated against per-method Zod schemas
- [ ] Invalid params return `INVALID_PARAMS` error
- [ ] Unknown methods return `METHOD_NOT_FOUND` error
- [ ] Side-effecting methods require `idempotencyKey`
- [ ] Duplicate idempotency keys return cached result without re-executing
- [ ] Idempotency keys are namespaced as `deviceId + method + key`
- [ ] Expired keys are cleaned up and allow re-execution
- [ ] Handler receives typed `RpcContext` with connection metadata
- [ ] All tests pass
- [ ] Structured error responses follow `ProtocolError` schema

## Priority
**High** — the RPC router is the dispatch backbone of the gateway.

**Scoring:**
- User Impact: 5 (all functionality flows through here)
- Strategic Alignment: 5 (core protocol layer)
- Implementation Feasibility: 4 (well-defined patterns)
- Resource Requirements: 3 (moderate complexity)
- Risk Level: 2 (idempotency is correctness-critical)
- **Score: 4.2**

## Dependencies
- **Blocks:** #010, #014, #016, #022, #023
- **Blocked by:** #002, #003, #005, #007

## Implementation Size
- **Estimated effort:** Medium–Large (3-4 days)
- **Labels:** `enhancement`, `high-priority`, `phase-3`, `gateway`, `protocol`
