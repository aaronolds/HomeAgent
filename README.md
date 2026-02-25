# HomeAgent

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Node >=22](https://img.shields.io/badge/node-%3E%3D22.0.0-339933?logo=node.js&logoColor=white)
![pnpm workspace](https://img.shields.io/badge/package%20manager-pnpm-F69220?logo=pnpm&logoColor=white)

HomeAgent is a self-hosted personal AI assistant platform with a modular, monorepo architecture. It is designed for local control, privacy, and extensibility across messaging providers, runtime tools, and agent capabilities.

This repository contains the v1 implementation workspace and backlog artifacts.

## What HomeAgent Includes

- Gateway service with typed RPC/event protocol and auth handshakes
- Agent runtime for session handling, context assembly, streaming, and tool execution
- Provider modules (for example Telegram and future channels)
- Node host support for secure remote capabilities and browser proxying
- Plugin and skills packages for extensibility
- CLI and config packages for operator workflows
- Test and security hardening milestones tracked in issue specs

## Repository Structure

```text
.
├── docs/                  # Architecture and planning documents
├── issues/                # Numbered implementation backlog (001-018)
├── packages/
│   ├── cli/
│   ├── config/
│   ├── gateway/
│   ├── node/
│   ├── plugins/
│   ├── providers/
│   ├── runtime/
│   ├── shared/
│   ├── skills/
│   └── tools/
├── package.json           # Workspace scripts
├── pnpm-workspace.yaml    # Monorepo package mapping
└── tsconfig.json
```

## Prerequisites

- Node.js `>=22.0.0`
- `pnpm`

## Getting Started

```bash
pnpm install
```

## Workspace Commands

Run these from the repository root:

```bash
pnpm dev     # Starts gateway dev flow (@homeagent/gateway)
pnpm build   # Builds all packages with a build script
pnpm test    # Runs Vitest suite
pnpm lint    # Runs Biome checks
```

## Usage

### Starting the Gateway

The gateway is the core server component. It accepts WebSocket connections from devices with HMAC-authenticated handshakes.

**Local development (no TLS):**

```bash
pnpm build
node packages/gateway/dist/cli.js --insecure
```

The gateway listens on `http://0.0.0.0:8080` in insecure mode.

**Production (TLS enabled, default):**

```bash
node packages/gateway/dist/cli.js
```

When no `--cert`/`--key` is provided, a self-signed certificate is auto-generated and stored in `.homeagent/certs/`. The gateway listens on `https://0.0.0.0:8443`.

**With your own TLS certificate:**

```bash
node packages/gateway/dist/cli.js --cert /path/to/cert.pem --key /path/to/key.pem
```

### CLI Flags

| Flag | Default | Description |
|---|---|---|
| `--port` | `8443` (TLS) / `8080` (insecure) | Listen port |
| `--host` | `0.0.0.0` | Listen address |
| `--insecure` | off | Disable TLS for local development |
| `--cert` | — | Path to TLS certificate (requires `--key`) |
| `--key` | — | Path to TLS private key (requires `--cert`) |
| `--data-dir` | `.homeagent` | Data directory for devices, certs, and audit log |
| `--nonce-window` | `300000` | Nonce replay window in milliseconds |
| `--timestamp-skew` | `30000` | Allowed clock skew in milliseconds |
| `--session-ttl` | `900000` | JWT session token TTL in milliseconds |

### Scenario: Registering and Connecting a Device

Devices must be registered with a shared secret and approved before they can connect.

1. **Register a device** — add a device record to the gateway's device registry (`<data-dir>/devices.json`) with a `deviceId` and `sharedSecret`. The planned CLI onboarding wizard automates this, but you can create entries directly:

   ```json
   {
     "deviceId": "my-laptop",
     "sharedSecret": "a-long-random-secret",
     "approved": true,
     "name": "My Laptop"
   }
   ```

2. **Connect via WebSocket** — open a WebSocket to `ws://host:port/ws` (or `wss://` with TLS) and send a `connect` message as the first frame:

   ```json
   {
     "role": "client",
     "deviceId": "my-laptop",
     "nonce": "unique-random-value",
     "timestamp": 1740000000000,
     "signature": "<HMAC-SHA256 hex of 'my-laptop:nonce:timestamp' using shared secret>"
   }
   ```

3. **Receive `connect_ok`** — on success the server responds with a session token:

   ```json
   {
     "connectionId": "uuid",
     "approved": true,
     "serverVersion": "0.0.1",
     "heartbeatSec": 30,
     "sessionToken": "<JWT>"
   }
   ```

4. **Send heartbeats** — keep the session alive by sending periodic heartbeat frames:

   ```json
   { "type": "heartbeat", "sessionToken": "<current JWT>" }
   ```

   The server responds with a refreshed token in `heartbeat_ack`.

### Scenario: Sending an RPC Request

Once authenticated, send JSON-RPC-style envelopes over the WebSocket:

```json
{
  "version": "1.0",
  "id": "req-001",
  "method": "session.resolve",
  "params": { "deviceId": "my-laptop" },
  "ts": 1740000000000
}
```

Side-effecting methods (`message.send`, `agent.run`, `node.exec.request`, `node.exec.approve`) require an `idempotencyKey` field to prevent duplicate processing.

### Available RPC Methods

| Method | Description | Idempotency Key |
|---|---|---|
| `session.resolve` | Resolve or create a session | No |
| `message.send` | Send a message to a session | Required |
| `agent.run` | Start an agent run | Required |
| `agent.cancel` | Cancel a running agent | No |
| `status.get` | Query run or session status | No |
| `node.exec.request` | Request command execution on a node | Required |
| `node.exec.approve` | Approve or reject an exec request | Required |
| `device.revoke` | Revoke a device (admin only) | No |
| `plugin.disable` | Disable a plugin (admin only) | No |

### Scenario: Role-Based Access

Each device connects with a role (`client`, `node`, or `admin`). Permissions are enforced per method:

- **client** — can resolve sessions, send messages, run agents, request exec, and query status.
- **node** — can only query status. Used for headless remote hosts.
- **admin** — full access including device revocation, exec approval, and plugin management.

### Security Features

- **TLS by default** with auto-generated self-signed certificates
- **HMAC-SHA256 device authentication** with timing-safe comparison
- **Nonce replay protection** with a configurable sliding window
- **JWT session tokens** refreshed on each heartbeat
- **RBAC** across three roles: `client`, `node`, `admin`
- **Rate limiting** per-IP connections, per-device RPC, and per-device agent runs
- **Frame size limits** (default 1 MB)
- **Append-only audit log** at `<data-dir>/audit.jsonl`

## Planning and Backlog

- Architecture: `docs/architecture.md`
- Combined plan: `docs/plan.combined.md`
- Implementation backlog: `issues/README.md`

The backlog includes dependency-aware execution waves and identifies which issues can be worked in parallel.

## License

This project is licensed under the MIT License. See `LICENSE` for details.
