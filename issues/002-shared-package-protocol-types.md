# Shared Package: Protocol Types & Zod Schemas

## Overview
Create the `packages/shared` package containing all foundational Zod schemas, TypeScript types, and protocol definitions. This is the single source of truth for the WebSocket handshake, RPC envelopes, events, RBAC roles, and error codes that every other package depends on.

## Scope

**Included:**
- Package scaffold (`package.json`, `tsconfig.json`, `src/index.ts`)
- WebSocket handshake schemas (`connect`, `connect_ok`, `error`)
- RPC envelope schemas (request, response, event)
- Role and permission type definitions (`client`, `node`, `admin`)
- Core RPC method parameter/result schemas for all v1 methods
- Shared error code enum
- Shared utility types (branded types for `AgentId`, `SessionId`, `DeviceId`, `RunId`, etc.)
- Export of inferred TypeScript types from Zod schemas

**Excluded:**
- JSON Schema generation (see #005)
- Implementation logic — this package is types and validation only

## Technical Requirements

### Handshake Schemas
```typescript
import { z } from 'zod';

// Branded ID types for type safety
export const AgentId = z.string().brand('AgentId');
export const SessionId = z.string().brand('SessionId');
export const DeviceId = z.string().brand('DeviceId');
export const ConnectionId = z.string().brand('ConnectionId');
export const RunId = z.string().brand('RunId');

export const Role = z.enum(['client', 'node', 'admin']);

export const ConnectRequest = z.object({
  role: Role,
  deviceId: DeviceId,
  authToken: z.string(),
  nonce: z.string(),
  timestamp: z.number(),
  agentId: AgentId.optional(),
  capabilities: z.array(z.string()).optional(),
});

export const ConnectOk = z.object({
  connectionId: ConnectionId,
  approved: z.literal(true),
  serverVersion: z.string(),
  heartbeatSec: z.number().int().positive(),
  sessionToken: z.string(),
});

export const ProtocolError = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
});
```

### RPC Envelope Schemas
```typescript
export const RpcRequest = z.object({
  id: z.string(),
  method: z.string(),
  params: z.record(z.unknown()).optional(),
  idempotencyKey: z.string().optional(),
  ts: z.number(),
});

export const RpcResponse = z.object({
  id: z.string(),
  result: z.unknown().optional(),
  error: ProtocolError.optional(),
});

export const RpcEvent = z.object({
  event: z.string(),
  data: z.unknown(),
  ts: z.number(),
});
```

### RBAC Permission Matrix
```typescript
export const SIDE_EFFECTING_METHODS = [
  'message.send',
  'agent.run',
  'node.exec.request',
  'node.exec.approve',
  'device.revoke',
  'plugin.disable',
] as const;

export const PERMISSION_MATRIX: Record<string, Record<string, boolean>> = {
  'session.resolve':    { client: true,  node: false, admin: true },
  'message.send':       { client: true,  node: false, admin: true },
  'agent.run':          { client: true,  node: false, admin: true },
  'agent.cancel':       { client: true,  node: false, admin: true },
  'status.get':         { client: true,  node: true,  admin: true },
  'node.exec.request':  { client: true,  node: false, admin: true },
  'node.exec.approve':  { client: false, node: false, admin: true },
  'device.revoke':      { client: false, node: false, admin: true },
  'plugin.disable':     { client: false, node: false, admin: true },
};
```

### Error Codes
```typescript
export const ErrorCode = z.enum([
  'INVALID_HANDSHAKE',
  'AUTH_FAILED',
  'NONCE_REUSED',
  'SESSION_TOKEN_EXPIRED',
  'DEVICE_NOT_APPROVED',
  'PERMISSION_DENIED',
  'METHOD_NOT_FOUND',
  'INVALID_PARAMS',
  'IDEMPOTENCY_KEY_REQUIRED',
  'IDEMPOTENCY_KEY_CONFLICT',
  'RATE_LIMITED',
  'MESSAGE_TOO_LARGE',
  'ORIGIN_REJECTED',
  'SESSION_NOT_FOUND',
  'AGENT_NOT_FOUND',
  'EXEC_DENIED',
  'PLUGIN_ERROR',
  'INTERNAL_ERROR',
]);
```

## Implementation Plan

1. Create `packages/shared/package.json` with `zod` dependency
2. Create `packages/shared/tsconfig.json` extending root config
3. Create `packages/shared/src/index.ts` as barrel export
4. Create `packages/shared/src/schemas/handshake.ts` — connect/disconnect schemas
5. Create `packages/shared/src/schemas/rpc.ts` — envelope schemas
6. Create `packages/shared/src/schemas/methods.ts` — per-method param/result schemas
7. Create `packages/shared/src/schemas/events.ts` — event data schemas
8. Create `packages/shared/src/types/ids.ts` — branded ID types
9. Create `packages/shared/src/types/roles.ts` — RBAC types and permission matrix
10. Create `packages/shared/src/types/errors.ts` — error code enum
11. Write unit tests for schema validation (valid/invalid inputs)
12. Verify all types export correctly from `src/index.ts`

## Acceptance Criteria
- [ ] `packages/shared` builds without errors
- [ ] All Zod schemas parse valid inputs and reject invalid inputs (unit tests)
- [ ] Branded ID types prevent accidental type mixing (`AgentId` vs `SessionId`)
- [ ] RBAC permission matrix covers all v1 RPC methods
- [ ] Side-effecting methods are enumerated for idempotency enforcement
- [ ] Error codes cover all documented error conditions
- [ ] Types are exported and importable from other packages via `@homeagent/shared`
- [ ] `pnpm test` passes for this package

## Priority
**Critical** — all other packages import types from shared.

**Scoring:**
- User Impact: 5 (every feature depends on these types)
- Strategic Alignment: 5 (type safety is core to the architecture)
- Implementation Feasibility: 5 (well-defined scope)
- Resource Requirements: 2 (moderate schema authoring)
- Risk Level: 1 (low risk — pure types and validation)
- **Score: 12.5**

## Dependencies
- **Blocks:** #003, #005, #006, #007, #008, #009, #010, #014, #016, #020, #022, #024
- **Blocked by:** #001

## Implementation Size
- **Estimated effort:** Medium (2-3 days)
- **Labels:** `enhancement`, `high-priority`, `phase-1`, `shared`, `protocol`
