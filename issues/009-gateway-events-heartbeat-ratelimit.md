# Gateway: Event Bus, Heartbeat, Rate Limiting & Security Hardening

## Overview
Implement the event broadcasting system, heartbeat/keepalive protocol, rate limiting, and remaining network security hardening for the gateway. These are the operational features that make the gateway production-ready.

## Scope

**Included:**
- **Event bus:** typed event broadcasting to connected clients, with backpressure-safe write queuing
- **Heartbeat protocol:** periodic server-sent pings, client-expected pongs; configurable interval (`heartbeatSec`); session token refresh on each heartbeat
- **Rate limiting:**
  - Per-IP connection rate limit (default: 10/min)
  - Per-device RPC rate limit (default: 60/min)
  - Per-device `agent.run` rate limit (default: 10/min)
  - Return `RATE_LIMITED` error when exceeded
- **Message size limits:** reject WebSocket frames exceeding configurable max (default: 1MB)
- **CORS policy:** strict defaults for co-hosted HTTP endpoints

**Excluded:**
- Full authentication (see #006)
- RBAC (see #007)
- RPC routing (see #008)

## Technical Requirements

### Event Bus
```typescript
class EventBus {
  // Broadcast to all connections, filtered by agentId if specified
  broadcast(event: RpcEvent, filter?: { agentId?: string; role?: string }): void;
  
  // Send to specific connection
  send(connectionId: string, event: RpcEvent): void;
  
  // Backpressure: if socket.bufferedAmount exceeds threshold, queue/drop
  private safeSend(socket: WebSocket, data: string): boolean;
}
```

### Heartbeat Protocol
```typescript
// Server sends ping every heartbeatSec
// Client must respond within heartbeatSec * 2 or connection is terminated
// Each successful heartbeat refreshes the session token
```

### Rate Limiter
```typescript
interface RateLimitConfig {
  connectionPerIp: { max: number; windowMs: number };  // 10/min
  rpcPerDevice: { max: number; windowMs: number };      // 60/min
  agentRunPerDevice: { max: number; windowMs: number }; // 10/min
}
```
- Use a sliding window counter (in-memory)
- Rate limit config stored in `packages/config`

### Message Size
- Set `maxPayload` in `@fastify/websocket` options
- Also validate on parse — reject frames > limit before JSON parse

## Implementation Plan

1. Create `packages/gateway/src/events/bus.ts` — event bus with broadcast and per-connection send
2. Add backpressure handling: check `bufferedAmount`, queue if over threshold, drop with warning if queue full
3. Create `packages/gateway/src/ws/heartbeat.ts` — heartbeat timer per connection
4. Implement session token refresh on heartbeat response
5. Detect stale connections (missed heartbeat) and terminate
6. Create `packages/gateway/src/middleware/rate-limit.ts` — sliding window rate limiter
7. Wire rate limiter into the RPC dispatch pipeline (pre-handler)
8. Add CORS headers to HTTP endpoints via `@fastify/cors`
9. Verify `maxPayload` is set on WebSocket server
10. Make all limits configurable via `packages/config`
11. Write tests:
    - Event broadcast reaches correct connections
    - Backpressure: events are queued when socket is slow
    - Heartbeat timeout disconnects stale connection
    - Session token changes after heartbeat refresh
    - Rate limit: 61st RPC in 1 minute returns `RATE_LIMITED`
    - Oversized WebSocket frame is rejected
    - Cross-origin request is rejected by CORS

## Acceptance Criteria
- [ ] Event bus broadcasts typed events to connected clients
- [ ] Events can be filtered by agentId or role
- [ ] Backpressure handling prevents unbounded memory growth
- [ ] Heartbeat pings are sent at configured interval
- [ ] Stale connections (missed heartbeat) are terminated
- [ ] Session token is refreshed on each heartbeat
- [ ] Per-IP connection rate limit enforced
- [ ] Per-device RPC rate limit enforced
- [ ] Per-device `agent.run` rate limit enforced (prevents LLM cost explosion)
- [ ] Exceeded rate limits return `RATE_LIMITED` error
- [ ] Oversized WebSocket frames are rejected
- [ ] CORS headers are set on HTTP endpoints
- [ ] All rate limits are configurable
- [ ] All tests pass

## Priority
**High** — operational stability and cost protection.

**Scoring:**
- User Impact: 4 (stability + cost protection)
- Strategic Alignment: 5 (production readiness)
- Implementation Feasibility: 4 (well-known patterns)
- Resource Requirements: 3 (multiple subsystems)
- Risk Level: 2 (need to tune limits)
- **Score: 3.3**

## Dependencies
- **Blocks:** #014, #016, #022
- **Blocked by:** #003, #006, #007

## Implementation Size
- **Estimated effort:** Large (3-5 days)
- **Labels:** `enhancement`, `high-priority`, `phase-3`, `gateway`, `security`, `performance`
