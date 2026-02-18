# Complete RPC Method Schemas & JSON Schema Generation

## Overview
Finalize all v1 RPC method schemas in `packages/shared` and set up automated JSON Schema generation from Zod definitions. This provides machine-readable API documentation and enables cross-language client generation in the future.

## Scope

**Included:**
- Detailed Zod schemas for all v1 RPC method params and results:
  - `session.resolve` — params: `{ agentId, senderId?, channelId? }` → result: `{ sessionId }`
  - `message.send` — params: `{ agentId, sessionId, content, provider }` → result: `{ messageId }`
  - `agent.run` — params: `{ agentId, sessionId, input }` → result: `{ runId }`
  - `agent.cancel` — params: `{ runId }` → result: `{ cancelled: boolean }`
  - `status.get` — params: `{}` → result: `{ uptime, connections, agents, version }`
  - `node.exec.request` — params: `{ nodeId, command, args, cwd? }` → result: `{ requestId }`
  - `node.exec.approve` — params: `{ requestId, approved }` → result: `{ status }`
  - `device.revoke` — params: `{ deviceId }` → result: `{ revoked: boolean }`
  - `plugin.disable` — params: `{ pluginName }` → result: `{ disabled: boolean }`
- Event schemas: `agent.delta`, `agent.tool_call`, `agent.turn_complete`, `agent.error`, `node.exec.status`
- JSON Schema generation script using `zod-to-json-schema`
- Output JSON Schema files to `packages/config/schemas/`
- Protocol version field (`v: 1`) in all envelopes
- Compatibility guard: reject envelopes with unsupported version

**Excluded:**
- Client SDK generation (future)

## Technical Requirements

### JSON Schema Generation
```typescript
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ConnectRequest, RpcRequest, RpcResponse, RpcEvent } from '@homeagent/shared';

const schemas = {
  ConnectRequest: zodToJsonSchema(ConnectRequest),
  RpcRequest: zodToJsonSchema(RpcRequest),
  RpcResponse: zodToJsonSchema(RpcResponse),
  RpcEvent: zodToJsonSchema(RpcEvent),
};

// Write to packages/config/schemas/*.json
```

### Protocol Version
```typescript
export const RpcRequest = z.object({
  v: z.literal(1),
  id: z.string(),
  method: z.string(),
  params: z.record(z.unknown()).optional(),
  idempotencyKey: z.string().optional(),
  ts: z.number(),
});
```

## Implementation Plan

1. Add `zod-to-json-schema` as a dev dependency in `packages/shared`
2. Create per-method schemas in `packages/shared/src/schemas/methods/`
3. Create event schemas in `packages/shared/src/schemas/events/`
4. Add `v: z.literal(1)` to all envelope schemas
5. Create a generation script: `packages/shared/scripts/generate-json-schema.ts`
6. Output generated JSON Schema files to `packages/config/schemas/`
7. Add `generate:schemas` script to root `package.json`
8. Write tests validating each method schema with valid and invalid payloads
9. Test that version mismatch is rejected

## Acceptance Criteria
- [ ] All 9 RPC methods have Zod schemas for params and results
- [ ] All event types have Zod schemas
- [ ] Protocol version (`v: 1`) is present in all envelopes
- [ ] Envelopes with wrong version are rejected by Zod parse
- [ ] JSON Schema files are generated and written to `packages/config/schemas/`
- [ ] Generated JSON Schemas validate the same inputs as Zod schemas (round-trip test)
- [ ] `pnpm generate:schemas` runs successfully
- [ ] All tests pass

## Priority
**High** — schemas are required before building the RPC router.

**Scoring:**
- User Impact: 4 (enables typed API contracts)
- Strategic Alignment: 5 (type safety is core)
- Implementation Feasibility: 5 (well-defined)
- Resource Requirements: 2 (moderate)
- Risk Level: 1 (low)
- **Score: 10.0**

## Dependencies
- **Blocks:** #008 (RPC router needs method schemas)
- **Blocked by:** #002, #003

## Implementation Size
- **Estimated effort:** Medium (2-3 days)
- **Labels:** `enhancement`, `high-priority`, `phase-2`, `protocol`, `shared`
