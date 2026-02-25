# @homeagent/gateway

Gateway service for HomeAgent. It provides TLS (or optional plaintext), WebSocket connect handshake authentication, session token issuance/refresh, nonce replay protection, device registry loading, and audit logging.

## Run

From the repository root:

```bash
pnpm --filter @homeagent/gateway build
pnpm --filter @homeagent/gateway start
```

For local development:

```bash
pnpm --filter @homeagent/gateway dev
```

## CLI Usage

```bash
homeagent-gateway [flags]
```

Flags:

- `--insecure` Run without TLS (plaintext)
- `--port <number>` Listen port
- `--host <value>` Listen host
- `--cert <path>` TLS certificate path (PEM)
- `--key <path>` TLS private key path (PEM)
- `--data-dir <path>` Gateway data directory
- `--nonce-window <ms>` Nonce replay window in milliseconds
- `--timestamp-skew <ms>` Allowed timestamp skew in milliseconds
- `--session-ttl <ms>` Session token TTL in milliseconds

## TLS Behavior

- TLS is enabled by default.
- If no cert/key are provided, the gateway generates and uses a self-signed certificate.
- If `--cert` and `--key` are both provided, those files are used.
- `--insecure` disables TLS and starts the gateway in plaintext mode.

## Connect Authentication Flow

On connect, clients authenticate with an HMAC signature over:

- `deviceId`
- `nonce`
- `timestamp`

The signature is computed from `deviceId + nonce + timestamp` with the device shared secret. The gateway verifies signature validity, timestamp skew, and nonce freshness before establishing a session.

## Session Tokens

- A JWT session token is issued after a successful connect handshake.
- Heartbeat requests refresh the session token TTL.
- Token verification and refresh are handled by the gateway auth module.
