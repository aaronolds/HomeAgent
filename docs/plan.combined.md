# HomeAgent v1 Implementation Plan (TypeScript/Fastify)

## Summary

Based on priorities (`max reliability/performance`, `high plugin priority`, `TypeScript strength`), the v1 stack is:

- **Language:** TypeScript (Node.js 22 LTS)
- **Runtime fallback:** Bun may be evaluated later; Node.js 22 LTS is the baseline for maximum compatibility (Playwright, native modules)
- **Server framework:** Fastify (gateway + internal HTTP health/admin endpoints)
- **Realtime protocol:** WebSocket with typed JSON-RPC-style envelopes
- **Persistence:** JSONL transcripts as authoritative store in `~/.homeagent/agents/<agentId>/sessions/<sessionId>.jsonl`; SQLite for operational indexes (devices, approvals, idempotency keys)
- **Validation/type safety:** Zod + generated JSON Schema + strict TS config
- **Execution model:** Single gateway process, serialized agent loop per `sessionKey`
- **Monorepo:** pnpm workspaces

---

## Technology Decisions

| Concern | Choice | Rationale |
|---|---|---|
| Runtime | **Node.js 22 LTS** | Broad ecosystem compat, stable for Playwright and native modules |
| Language | **TypeScript** (strict, ESM) | Type safety, mirrors OpenClaw patterns |
| Server framework | **Fastify** | High-performance HTTP + WebSocket, plugin-friendly |
| Monorepo | **pnpm workspaces** | Fast installs, disk-efficient, great workspace support |
| Schema / validation | **Zod** | TypeScript-first, infer types from schemas, export JSON Schema for docs |
| LLM clients | `openai`, `@anthropic-ai/sdk` | Official SDKs, streaming support |
| Browser automation | **Playwright** | Cross-browser, canonical for headless automation |
| CLI | **Commander** | Mature, lightweight, good TypeScript support |
| Logging | **pino** | Fast, structured JSON logging, low overhead |
| Testing | **Vitest** | Fast, ESM-native, Jest-compatible API |
| Lint + format | **Biome** | Fast all-in-one linter + formatter, good defaults |

---

## Project Structure

```text
homeagent/
├── packages/
│   ├── shared/         # Zod schemas, protocol types, shared utilities
│   ├── gateway/        # Fastify + WebSocket server, RPC handlers, provider dispatch
│   ├── providers/      # Messaging provider modules
│   │   ├── telegram/
│   │   ├── whatsapp/
│   │   ├── slack/
│   │   └── discord/
│   ├── runtime/        # Agent runtime, agentic loop, context assembly
│   ├── tools/          # Core tool implementations (read, exec, browse)
│   ├── plugins/        # Plugin loader and official plugins
│   ├── cli/            # CLI commands, onboarding wizard
│   ├── node/           # Headless node for remote exec & browser proxy
│   ├── skills/         # Built-in skills (prompts + tool definitions)
│   └── config/         # Default config, JSON schema exports
├── docs/               # Architecture and design docs
├── package.json        # Root package.json with workspace scripts
├── pnpm-workspace.yaml
├── tsconfig.json       # Base TypeScript config
├── biome.json          # Linting / formatting config
└── .gitignore
```

---

## TypeScript Configuration

- Base `tsconfig.json` at root with strict mode: `noImplicitAny`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`
- Each package extends the base with its own `tsconfig.json`
- Target: ES2022 (Node.js 22 LTS baseline)
- Module: ESM (`"type": "module"` in all `package.json` files)
- Path aliases for cross-package imports via pnpm workspace protocol (`workspace:*`)

---

## Development Workflow

| Command | Purpose |
|---|---|
| `pnpm dev` | Start gateway in watch mode |
| `pnpm test` | Run all tests across packages (Vitest) |
| `biome check .` | Lint + format check |

Each package has its own `dev`, `test`, and `build` scripts.

---

## Public Interfaces / Types To Define First

1. **WebSocket handshake and session contract**
   - `connect` request: `{ role, deviceId, authToken, nonce, agentId?, capabilities? }`
     - `authToken`: HMAC signature over `deviceId + nonce + timestamp` using the device's shared secret (established during pairing)
     - `nonce`: single-use random value to prevent replay attacks; server rejects reused nonces within a configurable window
   - `connect_ok` event: `{ connectionId, approved, serverVersion, heartbeatSec, sessionToken }`
     - `sessionToken`: short-lived bearer token for subsequent RPC calls on this connection; refreshed on heartbeat
   - `error` event: `{ code, message, retryable }`
   - **Unapproved devices are rejected at connect time** — no session/metadata access before approval

2. **RPC envelope**
   - Request: `{ id, method, params, idempotencyKey?, ts }`
     - `idempotencyKey` is **required** for side-effecting methods (`message.send`, `agent.run`, `node.exec.request`, `node.exec.approve`); server rejects calls to these methods without one
     - Idempotency keys are namespaced as `deviceId + method + key` to prevent cross-principal collisions
   - Response: `{ id, result?, error? }`
   - Event: `{ event, data, ts }`

3. **Core RPC methods (v1)**
   - `session.resolve`
   - `message.send` *(requires idempotencyKey)*
   - `agent.run` *(requires idempotencyKey)*
   - `agent.cancel`
   - `status.get`
   - `node.exec.request` / `node.exec.approve` *(requires idempotencyKey)*
   - `device.revoke` — force-unpair a device or node
   - `plugin.disable` — emergency kill switch for a running plugin

4. **Role-Based Access Control (RBAC)**
   - Three roles: `client`, `node`, `admin`
   - Permission matrix enforced at the RPC router:
     | Method | `client` | `node` | `admin` |
     |---|---|---|---|
     | `session.resolve` | ✅ | ❌ | ✅ |
     | `message.send` | ✅ | ❌ | ✅ |
     | `agent.run` / `agent.cancel` | ✅ | ❌ | ✅ |
     | `status.get` | ✅ | ✅ | ✅ |
     | `node.exec.request` | ✅ | ❌ | ✅ |
     | `node.exec.approve` | ❌ | ❌ | ✅ |
     | `device.revoke` | ❌ | ❌ | ✅ |
     | `plugin.disable` | ❌ | ❌ | ✅ |
   - Nodes may only respond to exec requests and publish capabilities; they cannot initiate agent runs or send messages
   - Role is bound to the device during pairing and stored in SQLite; cannot be changed without re-pairing

4. **Plugin SDK surface (TS types)**
   - `registerTool(definition, handler)`
   - `registerRpcMethod(name, schema, handler)`
   - `registerProvider(providerModule)`
   - `registerBackgroundService(service)`
   - `registerCliCommand(name, schema, handler)`
   - `registerLoopHook(hookName, handler)`

6. **Persistence paths**
   - JSONL transcripts: `~/.homeagent/agents/<agentId>/sessions/<sessionId>.jsonl` (authoritative, append-only)
   - SQLite: `~/.homeagent/homeagent.db` (operational state: devices, approvals, idempotency keys, agent registry)
   - Secrets: `~/.homeagent/secrets/` — provider credentials and API keys encrypted at rest via OS keychain (`keytar`) or a master passphrase; file permissions hardened to `0600`
   - Audit log: `~/.homeagent/audit.jsonl` — append-only, immutable security event log

---

## Implementation Outline

### Phase 1: Scaffold & Tooling

1. **Initialize root project** — Create root `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `tsconfig.json`, `biome.json`

2. **Create shared package** (`packages/shared`) — Set up Zod, define initial protocol types (connect handshake, RPC frame, event frame, idempotency key). All other packages depend on this.

3. **Create gateway package** (`packages/gateway`) — Scaffold Fastify + WebSocket server with connect handshake validation using shared Zod schemas.

4. **Create remaining package stubs** (`runtime`, `tools`, `plugins`, `cli`, `node`, `skills`, `config`, `providers/`) — Minimal `package.json` + `tsconfig.json` + `index.ts` per package.

5. **Wire up cross-package imports** — Verify pnpm workspace protocol (`workspace:*`) resolves correctly between packages.

6. **Add dev tooling** — Biome config, root scripts (`dev`, `test`, `lint`), basic CI-ready test per package.

**Verification:** `pnpm install` succeeds, `pnpm test` passes trivial tests in each package, `biome check .` passes, gateway starts and accepts a WebSocket connection with valid handshake, cross-package imports resolve.

### Phase 2: Protocol & Schemas

1. Author Zod schemas in `packages/shared` for all RPC envelopes, methods, and events
2. Generate JSON Schema and typed client/server contracts
3. Add compatibility/version field in every envelope

### Phase 3: Gateway Core (Fastify + WS)

1. **TLS native support** — Fastify serves WebSocket over TLS by default; generate a self-signed cert during onboarding, support user-provided certs. Plaintext mode available only via explicit `--insecure` flag for local-only development
2. **Device authentication** — validate `authToken` (HMAC over `deviceId + nonce + timestamp`) against stored shared secret on every `connect`; reject replayed nonces; issue short-lived `sessionToken` on success
3. **Connection manager** with role-based auth and pairing state — unapproved devices are rejected at connect (no pre-approval access)
4. **RBAC enforcement** — RPC router checks role permissions (from §RBAC matrix) before dispatching any method call
5. Device approval flow — new devices must be approved via CLI or admin RPC before they can connect
6. RPC router with idempotency middleware (key storage in SQLite, TTL-based expiry, namespaced as `deviceId + method + key`)
7. Event bus with backpressure-safe streaming
8. Heartbeat/keepalive protocol based on `heartbeatSec` — includes `sessionToken` refresh on each heartbeat to limit stolen-token window
9. **Rate limiting** — per-IP connection rate limit (default 10/min), per-device RPC rate limit (default 60/min), per-device `agent.run` rate limit (default 10/min to prevent LLM cost explosion). Configurable via `packages/config`
10. **WebSocket origin validation** — validate `Origin` header on upgrade; reject cross-origin connections unless explicitly allowlisted. Define strict CORS policy for any co-hosted HTTP endpoints
11. **Message size limits** — reject WebSocket frames exceeding configurable max (default 1MB) to prevent resource exhaustion

### Phase 4: Persistence Layer

1. JSONL transcript writer — append-only per session at `~/.homeagent/agents/<agentId>/sessions/<sessionId>.jsonl`
2. SQLite for operational indexes (devices, approvals, idempotency keys, agent metadata) — WAL mode enabled, file permissions `0600`
3. Transactions for side-effecting RPCs
4. **Session isolation: DMs default to per-sender isolation** to prevent context leakage; shared session mode available as an opt-in configuration per agent
5. **Secrets storage** — provider tokens, LLM API keys, and device shared secrets stored encrypted via OS keychain integration (`keytar`) or AES-256 encryption with a master passphrase; plaintext secrets never written to disk. File permissions on `~/.homeagent/secrets/` hardened to `0700`/`0600`
6. **Audit log** — append-only `~/.homeagent/audit.jsonl` recording all security-relevant events: auth attempts (success/failure), device approvals/rejections/revocations, exec-approval state changes, RPC access denials, plugin lifecycle events, file access violations. Each entry includes actor, timestamp, event type, and outcome. Sensitive data (prompts, tool args, tokens) redacted by default via pino redaction paths

### Phase 5: Agent Runtime Loop (serial per session)

1. Session lock manager keyed by `agentId+sessionId`
2. **Bootstrap file injection** — on first turn, inject `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md` into prompt from agent workspace
3. **Workspace file loading** — on every turn, reload workspace files (e.g. updated `AGENTS.md`, user-created context files) into the prompt alongside session history
4. **Context assembly with memory and compaction:**
   - Token budget tracking: calculate remaining tokens after system prompt, bootstrap files, and workspace files
   - **Rolling summary compaction:** when session transcript exceeds a configurable token threshold (e.g. 75% of context window), generate a summary of older turns using the LLM and replace them with the summary block
   - Compacted summaries stored as `<sessionId>.compacted.jsonl` alongside the full transcript for auditability
   - Recency bias: always include the most recent N turns verbatim (configurable, default 20); only older turns are compaction candidates
   - Trigger: compaction runs at the start of context assembly when the transcript exceeds the threshold, not mid-turn
5. Model streaming adapter abstraction — stream assistant deltas back to clients over WebSocket
6. Tool-call execution with deterministic replay protections and streamed results
7. Persistence — append turn to JSONL transcript
8. **Run ID lifecycle** — each `agent.run` invocation returns a unique `runId`; clients use it to track progress, cancel, and correlate streamed events to a specific invocation within a session
9. **Agentic loop hook points** — the loop exposes named hooks for custom logic injection:
   - `onIntake` — after request validation, before session resolution
   - `onContextAssembled` — after context assembly, before model inference (allows prompt rewriting or injection)
   - `onModelResponse` — after model response, before tool execution (allows response filtering or logging)
   - `onToolResult` — after each tool execution, before continuing the loop (allows result transformation or audit)
   - `onTurnComplete` — after persistence, before returning to caller (allows side-effects like notifications)
   - Hooks are registered via the plugin SDK (`registerLoopHook(hookName, handler)`) and executed in registration order
   - **Hook trust tiers:** `onContextAssembled` and `onModelResponse` are classified as **privileged hooks** — only built-in plugins and plugins explicitly granted `privileged_hooks` permission in their manifest may register them. This prevents untrusted plugins from reading/exfiltrating conversation context or injecting prompt content
10. **Prompt injection mitigations:**
    - Workspace files and user-generated content are wrapped in clearly delimited markers (e.g., `<user_context>...</user_context>`) to distinguish from system instructions
    - Tool results are sanitized and length-capped before inclusion in prompt
    - All context assembly inputs are logged to the audit trail for forensic review

### Phase 6: Multi-Agent Support

1. Per-agent workspace directories under `~/.homeagent/agents/<agentId>/`
2. Agent registry with isolated state, skill sets, and configuration
3. **Binding system** — route inbound messages from providers to the correct agent based on channel/sender bindings
4. Separate per-agent sessions ensure data isolation

### Phase 7: Skills, Tools & Plugin SDK

1. **Skills package** (`packages/skills`) — bundles of prompts + tool definitions, distinct from raw tools
2. Core tools: file read/write, command execution, web browsing
3. **Plugin trust model:**
   - Plugins are categorized as **built-in** (shipped with HomeAgent, fully trusted) or **third-party** (user-installed, sandboxed)
   - Plugin manifest format: `{ name, version, author, capabilities, permissions, signature? }`
   - Third-party plugins must declare required permissions explicitly: `fs_read`, `fs_write`, `network`, `exec`, `privileged_hooks`
   - **Plugin signing** — optional but recommended: plugins may include a signature verified against a known publisher key. Unsigned plugins require explicit user confirmation during install
   - **Permission enforcement** — plugin capabilities are checked at runtime; undeclared access attempts are blocked and logged to audit trail
4. **Sandboxed loading policy:**
   - Third-party plugins run in child processes with Node.js `--experimental-permission` flag to restrict `fs`, `net`, and `child_process` access at the V8 level
   - **Egress control** — third-party plugin processes have outbound network disabled by default; plugins must declare `network` permission and specify allowed hosts in manifest to enable outbound calls
   - Built-in plugins run in the main process (trusted boundary)
5. Lifecycle hooks (`init`, `start`, `stop`) for background services with health-check and restart
6. Dynamic registration of RPC methods, tools, CLI commands, and background services

### Phase 8: First Provider + Node Host

1. **Provider v1:** Telegram (low friction, good API)
2. Provider module interface: authentication, inbound message parsing, outbound message formatting
3. **Node host:** secure connect with `role: node`, cryptographic auth (same HMAC challenge as clients), capability advertisement (command execution, canvas, camera, location)
4. Browser proxy publishing for browsing tasks
5. **Scoped exec-approval system:**
   - Exec-approval file is a JSON allowlist (not binary on/off) specifying permitted command patterns, argument constraints, and allowed working directories
   - Example: `{ "allow": [{ "command": "git", "args": ["status", "log", "diff"] }, { "command": "npm", "args": ["run *"] }], "deny": [{ "command": "rm" }] }`
   - Commands not matching any allow pattern are rejected; deny patterns take precedence
   - All exec requests and outcomes are logged to the audit trail with full command, args, exit code, and requesting agent/device
   - **Shell injection prevention** — commands are executed via `execFile` (not `exec`/shell) with arguments as arrays; no shell interpolation

### Phase 9: CLI & Operator Workflows

1. Onboarding wizard (agent creation, provider credentials, node pairing with shared-secret exchange)
2. Commands: `send`, `agent run`, `status`, `sessions`, `approvals`, `diagnostics`
3. **Incident response commands:**
   - `device revoke <deviceId>` — force-unpair and invalidate all sessions for a device
   - `plugin disable <pluginName>` — emergency kill switch to stop and unload a plugin
   - `sessions kill <sessionId>` — terminate an active session immediately
   - `audit tail` — stream recent security audit events
   - `secrets rotate <provider|llm>` — rotate and re-encrypt a credential
4. Configuration management via `packages/config` with JSON schema defaults

---

## Test Cases and Scenarios

1. **Protocol correctness**
   - Reject malformed handshake
   - Enforce schema validation on every RPC
   - Ensure unknown methods return typed errors

2. **Idempotency and consistency**
   - Duplicate `idempotencyKey` returns same result
   - Crash/restart mid-request does not double-apply side effects

3. **Session concurrency**
   - Parallel requests to same `sessionKey` are serialized
   - Different sessions run concurrently without cross-talk

4. **Security — Authentication & Authorization**
   - Unapproved device rejected at `connect` — no RPC/metadata access
   - Spoofed `deviceId` without valid `authToken` is rejected
   - Replayed nonce is rejected
   - Expired `sessionToken` is rejected; heartbeat refresh issues new token
   - Role-restricted RPC: `client` role cannot call `node.exec.approve` or `device.revoke`
   - Node role cannot call `agent.run` or `message.send`

5. **Security — Data & Input**
   - Path traversal (`../../etc/passwd`) blocked by `fs.realpath` + prefix check
   - Symlink escape from agent workspace is rejected
   - `agentId` / `sessionId` with `/`, `\`, `..`, or null bytes rejected at validation
   - Shell injection via tool args blocked (`execFile` with array args, no shell)
   - Secrets never appear in application logs (pino redaction verified)

6. **Security — Sandboxing & Network**
   - Third-party plugin child process cannot access filesystem outside declared permissions
   - Third-party plugin with no `network` permission cannot make outbound HTTP calls
   - WebSocket connection from non-allowlisted origin is rejected
   - Rate limit exceeded returns `429` and does not process the RPC
   - Oversized WebSocket frame is rejected

7. **Security — Exec & Plugins**
   - `node.exec.request` for command not in allowlist is rejected
   - Deny pattern overrides matching allow pattern
   - Unsigned third-party plugin requires user confirmation before loading
   - Plugin attempting to register `onContextAssembled` without `privileged_hooks` permission is rejected
   - `device.revoke` immediately terminates all active connections for that device
   - All security events appear in `audit.jsonl` with correct actor, timestamp, and outcome

6. **Persistence integrity**
   - JSONL transcripts are append-only and recoverable after crash
   - SQLite transaction rollback on operational failures

7. **Multi-agent isolation**
   - Agents cannot access each other's workspaces or sessions
   - Bindings correctly route messages to the right agent

8. **End-to-end**
   - Inbound provider message → runtime response → outbound provider send
   - Node capability used in tool call with audit trail recorded
   - Bootstrap files injected on first turn, context compacted on long sessions

---

## Security Considerations

### Authentication & Authorization
- **Device authentication:** every `connect` requires HMAC-signed challenge (`deviceId + nonce + timestamp`) against a shared secret established during pairing. No anonymous or unauthenticated access.
- **Nonce replay protection:** server maintains a sliding window of used nonces; duplicates are rejected
- **Session tokens:** short-lived bearer tokens issued on connect, refreshed on heartbeat; limit exposure window if stolen
- **RBAC:** role-based permission matrix enforced at the RPC router for every method call (see §RBAC section)
- **Unapproved devices rejected at connect** — no metadata, session, or RPC access before approval

### Data Security
- **Secrets at rest:** provider tokens, LLM API keys, and device shared secrets encrypted via OS keychain (`keytar`) or AES-256 with master passphrase. Never stored in plaintext. File permissions `0600`/`0700` on `~/.homeagent/secrets/`
- **SQLite hardening:** WAL mode, file permissions `0600`, regular integrity checks
- **Log redaction:** pino redaction paths strip sensitive data (prompts, tool arguments, tokens, API keys) from application logs by default
- **Session isolation:** per-sender DM isolation enabled by default; shared sessions are opt-in

### Input Validation & Injection Prevention
- **Path traversal protection:** all file tool paths resolved via `fs.realpath()` and verified to start with the allowed workspace prefix. Reject `agentId`/`sessionId` values containing `/`, `\`, `..`, or null bytes
- **Shell injection prevention:** remote commands executed via `execFile` (not `exec`/shell) with arguments as arrays; no shell interpolation
- **Prompt injection mitigations:** user-generated content delimited with markers; tool results sanitized and length-capped; context assembly inputs logged for forensic review
- **Zod validation:** every RPC request and event validated against Zod schemas before processing; malformed input rejected with typed errors

### Sandboxing & Isolation
- **Tool execution:** spawned child processes with `cwd` restricted to agent workspace, stripped environment variables
- **Node.js permission model:** use `--experimental-permission` flag to restrict `fs`, `net`, and `child_process` at the V8 level for third-party plugin processes
- **File access allowlist:** tools may only read/write within `~/.homeagent/agents/<agentId>/`; paths canonicalized to prevent symlink/TOCTOU escapes
- **Egress control:** third-party plugin processes have outbound network disabled by default; must declare `network` permission with allowed hosts
- **Resource limits:** tool execution timeouts (configurable, default 30s), memory caps via `--max-old-space-size` on child processes
- **Multi-agent isolation:** per-agent workspace directories, separate sessions, binding-based message routing; agents cannot access each other's files or state

### Network Security
- **TLS by default:** Fastify serves WebSocket over TLS natively; self-signed cert generated during onboarding, user-provided certs supported. Plaintext only via explicit `--insecure` flag
- **WebSocket origin validation:** `Origin` header checked on upgrade; cross-origin rejected unless allowlisted
- **CORS policy:** strict defaults for any co-hosted HTTP endpoints
- **Rate limiting:** per-IP connection limits, per-device RPC limits, per-device `agent.run` limits to prevent cost explosion and DoS
- **Message size limits:** WebSocket frames capped at configurable max (default 1MB)

### Plugin Security
- **Trust tiers:** built-in (fully trusted, main process) vs. third-party (sandboxed child process with restricted permissions)
- **Permission manifest:** third-party plugins must declare `fs_read`, `fs_write`, `network`, `exec`, `privileged_hooks` — undeclared access is blocked and logged
- **Plugin signing:** optional verification against known publisher keys; unsigned plugins require explicit user confirmation
- **Privileged hook restriction:** `onContextAssembled` and `onModelResponse` hooks limited to built-in plugins and plugins with explicit `privileged_hooks` permission

### Exec Approval Security
- **Scoped allowlists:** exec-approval file is a JSON allowlist of permitted commands, argument patterns, and working directories — not binary on/off
- **Deny precedence:** deny patterns override allow patterns
- **Full audit:** every exec request logged with command, args, exit code, requesting agent/device

### Audit & Incident Response
- **Immutable audit log:** `~/.homeagent/audit.jsonl` records auth attempts, device approvals/revocations, exec events, RPC access denials, plugin lifecycle, file access violations
- **Incident response CLI:** `device revoke`, `plugin disable`, `sessions kill`, `secrets rotate`, `audit tail`
- **Secret rotation:** CLI command to rotate and re-encrypt provider tokens and API keys without downtime
- **Monitoring hooks:** audit events available to plugins for alerting on anomalies (failed pairings, auth spikes, cross-agent access attempts)

---

## Assumptions and Defaults

- Single-host gateway in v1 (no horizontal scaling initially)
- Node.js 22 LTS runtime baseline
- JSONL is authoritative transcript store; SQLite is operational index layer
- Plugin API considered public in v1 but versioned (`sdkApiVersion`) from day one
- Transport security: TLS enabled by default on the gateway; `--insecure` flag available for local-only development. VPN recommended as additional layer for remote access
- ESM only — no CommonJS throughout the monorepo

---

## Key Decisions & Rationale

| Decision | Rationale |
|---|---|
| **Node.js over Bun** | Broader ecosystem compatibility, especially Playwright and native modules. Bun can be revisited when its compat story matures. |
| **pnpm over npm** | Faster installs, better workspace support, disk-efficient via content-addressable store. |
| **Zod over JSON Schema + ajv** | Better TypeScript DX; can still export JSON Schema for docs and cross-language clients. |
| **Biome over ESLint + Prettier** | Single fast tool replaces two, simpler config, good defaults. |
| **JSONL-primary persistence** | Matches architecture spec, human-readable, portable, trivially inspectable. SQLite supplements for operational queries. |
| **ESM only** | Clean module system throughout, future-proof. |
| **Fastify over Express** | Schema-based validation, plugin system, better performance. |
