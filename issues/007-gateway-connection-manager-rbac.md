# Gateway: Connection Manager & RBAC Enforcement

## Overview
Implement the connection manager that tracks all active WebSocket connections by device, role, and agent, and enforce role-based access control (RBAC) for every RPC method call. The connection manager is the central registry the gateway uses to route events and enforce permissions.

## Scope

**Included:**
- Connection registry: track active connections with metadata (deviceId, role, agentId, connectionId, connectedAt)
- Connection lifecycle: add on `connect_ok`, remove on disconnect/error
- Role lookup per connection for RBAC checks
- RBAC middleware: check permission matrix before dispatching any RPC method
- Reject unauthorized calls with `PERMISSION_DENIED` error
- List active connections for admin/status purposes
- Force-disconnect a device (support for `device.revoke`)

**Excluded:**
- Authentication/handshake validation (see #006)
- RPC routing logic (see #008)
- Heartbeat/keep-alive (see #009)

## Technical Requirements

### Connection Registry
```typescript
interface ActiveConnection {
  connectionId: string;
  deviceId: string;
  role: 'client' | 'node' | 'admin';
  agentId?: string;
  socket: WebSocket;
  connectedAt: number;
  sessionToken: string;
}

class ConnectionManager {
  private connections = new Map<string, ActiveConnection>();

  add(conn: ActiveConnection): void;
  remove(connectionId: string): void;
  getByDevice(deviceId: string): ActiveConnection[];
  getByRole(role: string): ActiveConnection[];
  getAll(): ActiveConnection[];
  disconnectDevice(deviceId: string): number; // returns count of closed connections
}
```

### RBAC Middleware
```typescript
import { PERMISSION_MATRIX } from '@homeagent/shared';

function checkPermission(method: string, role: string): boolean {
  const perms = PERMISSION_MATRIX[method];
  if (!perms) return false; // unknown method → deny by default
  return perms[role] === true;
}
```

- Middleware runs before every RPC handler
- Returns `PERMISSION_DENIED` error if role is not authorized
- Returns `METHOD_NOT_FOUND` if method is not in the matrix

## Implementation Plan

1. Create `packages/gateway/src/connections/manager.ts` — connection registry class
2. Create `packages/gateway/src/connections/types.ts` — connection types
3. Create `packages/gateway/src/middleware/rbac.ts` — RBAC check function
4. Integrate connection manager into WebSocket handler: register on `connect_ok`, unregister on close
5. Wire RBAC middleware into the RPC dispatch path (pre-handler hook)
6. Implement `disconnectDevice()` for `device.revoke` support
7. Add admin-only `status.get` handler that uses `getAll()` for connection stats
8. Write tests:
   - `client` can call `message.send` but not `device.revoke`
   - `node` can call `status.get` but not `agent.run`
   - `admin` can call everything
   - Unknown method returns `METHOD_NOT_FOUND`
   - `disconnectDevice()` closes all connections for a device

## Acceptance Criteria
- [ ] Connection manager tracks all active connections
- [ ] Connections are removed cleanly on disconnect/error
- [ ] RBAC middleware enforces the full permission matrix from the spec
- [ ] `client` role is restricted to: `session.resolve`, `message.send`, `agent.run`, `agent.cancel`, `status.get`, `node.exec.request`
- [ ] `node` role is restricted to: `status.get`
- [ ] `admin` role has access to all methods
- [ ] Unauthorized calls return typed `PERMISSION_DENIED` error
- [ ] Unknown methods return `METHOD_NOT_FOUND`
- [ ] `disconnectDevice()` forcefully closes all connections for a given device
- [ ] All tests pass

## Priority
**High** — RBAC is a security requirement for all RPC methods.

**Scoring:**
- User Impact: 5 (security)
- Strategic Alignment: 5 (core architecture)
- Implementation Feasibility: 4 (straightforward)
- Resource Requirements: 2 (moderate)
- Risk Level: 2 (security-sensitive)
- **Score: 6.25**

## Dependencies
- **Blocks:** #008, #009, #023
- **Blocked by:** #002, #003, #006

## Implementation Size
- **Estimated effort:** Medium (2-3 days)
- **Labels:** `enhancement`, `high-priority`, `phase-3`, `gateway`, `security`
