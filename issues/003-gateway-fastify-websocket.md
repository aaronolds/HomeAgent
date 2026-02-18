# Gateway Package: Fastify + WebSocket Server Foundation

## Overview
Scaffold the `packages/gateway` package with a Fastify HTTP server and WebSocket upgrade handler. This establishes the core server that all clients, nodes, and providers connect to. In this issue, we implement the basic server lifecycle and WebSocket connection acceptance with handshake validation using shared Zod schemas.

## Scope

**Included:**
- Package scaffold (`package.json`, `tsconfig.json`, entry point)
- Fastify server with configurable host/port
- WebSocket upgrade handler using `@fastify/websocket`
- Connection acceptance with `connect` handshake validation (schema-only; full auth in #006)
- `connect_ok` response on successful handshake
- Typed `error` response for malformed handshakes
- Graceful server startup and shutdown lifecycle
- Health check HTTP endpoint (`GET /health`)
- Basic structured logging with pino

**Excluded:**
- TLS support (see #006)
- Device authentication / HMAC validation (see #006)
- RBAC enforcement (see #007)
- RPC routing (see #008)
- Event bus / heartbeat (see #009)

## Technical Requirements

### Fastify Server Setup
```typescript
import Fastify from 'fastify';
import websocket from '@fastify/websocket';

const server = Fastify({
  logger: { level: 'info' }, // pino
});

await server.register(websocket, {
  options: {
    maxPayload: 1_048_576, // 1MB default
  },
});

server.get('/health', async () => ({ status: 'ok', version: '0.1.0' }));

server.register(async (fastify) => {
  fastify.get('/ws', { websocket: true }, (socket, req) => {
    // Await connect handshake as first message
    // Validate against ConnectRequest schema
    // Reply with ConnectOk or ProtocolError
  });
});
```

### Dependencies
- `fastify` — HTTP server
- `@fastify/websocket` — WebSocket support
- `@homeagent/shared` (workspace dependency) — Zod schemas
- `pino` (via Fastify built-in)

### Server Lifecycle
- Start: bind to configured host:port, log startup
- Shutdown: close all WebSocket connections, drain HTTP, exit cleanly on SIGINT/SIGTERM

## Implementation Plan

1. Create `packages/gateway/package.json` with dependencies
2. Create `packages/gateway/tsconfig.json` extending root
3. Create `packages/gateway/src/index.ts` — server entry point
4. Create `packages/gateway/src/server.ts` — Fastify factory function
5. Create `packages/gateway/src/ws/handler.ts` — WebSocket upgrade + handshake validation
6. Create `packages/gateway/src/ws/connection.ts` — connection wrapper with typed send/receive
7. Add health check route
8. Add graceful shutdown handlers (SIGINT, SIGTERM)
9. Add dev script with watch mode (e.g., `tsx watch src/index.ts`)
10. Write integration tests: valid handshake accepted, malformed handshake rejected

## Acceptance Criteria
- [ ] `packages/gateway` builds without errors
- [ ] Server starts and binds to configurable host:port
- [ ] `GET /health` returns `200` with status and version
- [ ] WebSocket connection accepted at `/ws`
- [ ] First message must be a valid `ConnectRequest` per Zod schema
- [ ] Valid handshake receives `ConnectOk` response
- [ ] Invalid handshake receives typed `ProtocolError` and connection is closed
- [ ] Server shuts down gracefully on SIGINT/SIGTERM
- [ ] Structured JSON logging via pino
- [ ] `pnpm dev` starts the gateway in watch mode
- [ ] `pnpm test` passes for this package

## Priority
**Critical** — the gateway is the central hub for all communication.

**Scoring:**
- User Impact: 5 (required for any interaction)
- Strategic Alignment: 5 (core architecture component)
- Implementation Feasibility: 4 (Fastify well-documented)
- Resource Requirements: 2 (moderate)
- Risk Level: 1 (well-understood patterns)
- **Score: 12.5**

## Dependencies
- **Blocks:** #005, #006, #007, #008, #009
- **Blocked by:** #001, #002

## Implementation Size
- **Estimated effort:** Medium (2-3 days)
- **Labels:** `enhancement`, `high-priority`, `phase-1`, `gateway`
