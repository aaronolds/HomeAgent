# Security Policy

HomeAgent runs an agentic loop with native access to your filesystem, shell, and network.
This document describes the threat model, built-in mitigations, and recommended deployment practices.

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.
Email `security@homeagent.dev` with a description and reproduction steps.
You will receive a response within 72 hours.

---

## Threat Model

| Threat | Mitigation |
|---|---|
| Prompt injection causing unauthorized shell execution | Exec-approval workflow — every shell command requires explicit admin approval before running |
| Stolen device token replayed to impersonate a client | HMAC auth over `deviceId + nonce + timestamp`; server rejects reused nonces within a rolling window |
| Malicious plugin escalating privileges | Capability-based permission system; plugins declare required capabilities and are rejected if policy denies them |
| Session context leakage between users | Per-sender session isolation by default; shared sessions are opt-in per agent |
| Secrets exposed in logs or transcripts | Secrets stored encrypted via OS keychain or AES-256 with master passphrase; pino redaction strips secrets from log output |
| Unauthorized RPC access | RBAC (client / node / admin roles) enforced at the RPC router before dispatching any method |
| Resource exhaustion from runaway LLM calls | Per-device rate limits on connections, RPC calls, and `agent.run` invocations |
| Supply-chain attack via plugin | Plugins run with declared capabilities only; high-risk operations require Node.js `--experimental-permission` process isolation |

---

## Authentication

Every device is paired with a shared secret generated during onboarding.
Each WebSocket connection must present an `authToken` — an HMAC-SHA256 signature over `deviceId + nonce + timestamp` — which the gateway verifies against the stored secret.

- Single-use nonces prevent replay attacks.
- Short-lived session tokens (refreshed on heartbeat) limit the window for stolen-token abuse.
- Unapproved devices are rejected at connect time; they cannot access any session data before approval.

---

## Role-Based Access Control (RBAC)

Three roles are bound to a device at pairing time and cannot be changed without re-pairing:

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

---

## Capability-Based Permission System

Every tool and plugin must declare the capabilities it requires.
The runtime checks these against the active `PermissionPolicy` before execution.
If any required capability is not permitted, the tool call is rejected and the denial is written to the audit log.

### Available Capabilities

| Capability | Description |
|---|---|
| `fs.read` | Read files from the filesystem |
| `fs.write` | Write or delete files |
| `fs.exec` | Execute binaries directly |
| `net.outbound` | Make outbound network requests |
| `net.listen` | Bind to a local port |
| `shell.exec` | Run arbitrary shell commands |
| `browser` | Control a headless browser (Playwright) |
| `secrets.read` | Read stored secrets or API keys |
| `admin` | Perform administrative operations |

### Policy Format

Policies are stored in `~/.homeagent/policy.json` and support an allow list, a deny list, or both.
The deny list always takes precedence.

```json
{
  "allow": ["fs.read", "net.outbound"],
  "deny": ["shell.exec", "admin"]
}
```

A policy with neither `allow` nor `deny` permits all capabilities (useful during development).
In production, use an explicit `allow` list.

---

## Exec Approval Workflow

Shell commands (`shell.exec`, `fs.exec`) require an out-of-band approval from an `admin` device
before they are executed. The agent issues a `node.exec.request` RPC call; the request remains
pending until an admin approves it via `node.exec.approve` or a configurable timeout elapses.

This ensures a human is always in the loop before any shell command runs on the host.

---

## Secrets Storage

- Provider tokens, LLM API keys, and device shared secrets are stored encrypted via the OS keychain
  (`keytar`) or AES-256 encryption with a master passphrase when a keychain is unavailable.
- Plaintext secrets are never written to disk.
- The `~/.homeagent/secrets/` directory is created with `0700` permissions; individual files with `0600`.

---

## Audit Log

An append-only audit log is maintained at `~/.homeagent/audit.jsonl`.
Every security-relevant event is recorded with actor, timestamp, event type, and outcome:

- Authentication attempts (success and failure)
- Device approvals, rejections, and revocations
- Exec-approval state changes
- RPC access denials
- Plugin lifecycle events
- Permission policy violations

Sensitive data (prompts, tool arguments, tokens) is redacted by default.

---

## Container Deployment (Recommended)

Running HomeAgent in a Docker container is the recommended production deployment.
See [`docker-compose.yml`](./docker-compose.yml) for a hardened default configuration.

Key container security properties:

- **Non-root user** — process runs as `homeagent` (UID 1001)
- **Read-only root filesystem** — only named volumes and `/tmp` are writable
- **Dropped capabilities** — all Linux capabilities dropped; `NET_BIND_SERVICE` re-added only if needed
- **No new privileges** — `no-new-privileges:true` prevents privilege escalation via setuid/setgid
- **Resource limits** — CPU and memory limits prevent runaway agent loops from exhausting the host

---

## Network Hardening

- The gateway serves WebSocket over TLS by default; plaintext mode requires an explicit `--insecure` flag.
- WebSocket `Origin` header is validated; cross-origin connections are rejected unless explicitly allowlisted.
- All inbound WebSocket frames are capped at a configurable maximum size (default 1 MB) to prevent resource exhaustion.
- Per-IP connection rate limiting (default 10/min) and per-device RPC rate limiting (default 60/min).

---

## Dependency Security

- Dependencies are locked via `pnpm-lock.yaml` and verified with `pnpm install --frozen-lockfile`.
- A dependency audit (`pnpm audit`) is run in CI on every pull request.
- No secrets or credentials are committed to the repository; `.gitignore` excludes `.env` files.
