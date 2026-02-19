# Security Sequence Diagrams

UML sequence diagrams for HomeAgent security interactions. For flowcharts see [security.md](./security.md). For full details see [plan.combined.md](./plan.combined.md) § Security Considerations.

---

## Device Pairing & Authentication

Every device must complete a multi-step handshake before gaining any access to the system. The gateway first enforces network-level protections (TLS, origin validation, rate limiting), then requires the device to prove its identity via an HMAC-signed challenge using a shared secret established during pairing. Nonce replay protection and device approval status are verified before a short-lived session token is issued. Tokens are automatically refreshed via heartbeat to limit the exposure window if a token is compromised. Every rejection is recorded in the immutable audit log.

```mermaid
sequenceDiagram
    actor Device
    participant GW as Gateway
    participant Auth as Auth Module
    participant Audit as audit.jsonl

    Device->>GW: WebSocket upgrade (TLS)
    GW->>GW: Validate Origin header
    alt Origin rejected
        GW-->>Device: 403 Connection refused
        GW->>Audit: Log rejected origin
    end
    GW->>GW: Check rate limit (per-IP)
    alt Rate limit exceeded
        GW-->>Device: 429 Too Many Requests
        GW->>Audit: Log rate limit hit
    end
    GW-->>Device: WebSocket established

    Device->>GW: connect { deviceId, nonce, timestamp, hmacSignature }
    GW->>Auth: Verify HMAC(deviceId + nonce + timestamp, sharedSecret)
    alt Invalid signature
        Auth-->>GW: Reject
        GW-->>Device: Error: authentication failed
        GW->>Audit: Log failed auth (actor, timestamp)
    end
    Auth->>Auth: Check nonce sliding window
    alt Nonce replayed
        Auth-->>GW: Reject replay
        GW-->>Device: Error: nonce already used
        GW->>Audit: Log replay attempt
    end
    Auth->>Auth: Check device approval status
    alt Device not approved
        Auth-->>GW: Reject unapproved
        GW-->>Device: Error: device not approved
        GW->>Audit: Log unapproved connect
    end
    Auth-->>GW: Authenticated
    GW->>GW: Issue short-lived sessionToken
    GW-->>Device: connect.ok { sessionToken, expiresAt }
    GW->>Audit: Log successful auth (deviceId)

    loop Heartbeat
        Device->>GW: heartbeat { sessionToken }
        GW->>Auth: Validate & refresh token
        Auth-->>GW: New sessionToken
        GW-->>Device: heartbeat.ok { sessionToken, expiresAt }
    end
```

## RPC Request Authorization

Once authenticated, every RPC request passes through three validation layers before execution. The session token is verified for expiry, the request payload is validated against a strict Zod schema to reject malformed input, and the RBAC engine checks whether the caller's role is permitted to invoke the requested method. For example, a `client` role cannot call `node.exec.approve` and a `node` role cannot call `agent.run`. Idempotency keys ensure that duplicate requests return cached results rather than re-executing side effects.

```mermaid
sequenceDiagram
    actor Client
    participant GW as Gateway
    participant Router as RPC Router
    participant Zod as Zod Validator
    participant RBAC as RBAC Engine
    participant Handler as RPC Handler
    participant Audit as audit.jsonl

    Client->>GW: RPC { method, params, sessionToken, idempotencyKey }
    GW->>GW: Validate sessionToken
    alt Token expired or invalid
        GW-->>Client: 401 Unauthorized
        GW->>Audit: Log expired token access
    end

    GW->>Router: Route request
    Router->>Zod: Validate params against schema
    alt Schema validation fails
        Zod-->>Router: Validation error
        Router-->>Client: Error: malformed input
    end

    Router->>RBAC: Check role permission (role, method)
    Note over RBAC: client ✗ node.exec.approve<br/>client ✗ device.revoke<br/>node ✗ agent.run<br/>node ✗ message.send
    alt Role not permitted
        RBAC-->>Router: 403 Forbidden
        Router-->>Client: Error: insufficient permissions
        Router->>Audit: Log access denial (role, method)
    end

    Router->>Router: Check idempotencyKey
    alt Duplicate key
        Router-->>Client: Return cached result
    else New key
        Router->>Handler: Execute method
        Handler-->>Router: Result
        Router->>Router: Cache result by idempotencyKey
        Router-->>Client: RPC result
    end
```

## Remote Exec Approval

Remote command execution is the highest-risk operation in the system and is gated by a scoped policy engine on each node. When an agent requests execution, the node evaluates the command against a JSON allowlist of permitted commands, argument patterns, and working directories. Deny patterns take precedence over allow patterns to ensure dangerous commands cannot slip through. All execution attempts — approved or denied — are fully logged with command, arguments, exit code, and the requesting agent and device identifiers.

```mermaid
sequenceDiagram
    actor Agent
    participant RT as Runtime
    participant GW as Gateway
    participant Node as Node
    participant Policy as Exec Policy
    participant Audit as audit.jsonl

    Agent->>RT: Tool call: exec(command, args, cwd)
    RT->>GW: node.exec.request { command, args, cwd, agentId }
    GW->>Node: Forward exec request

    Node->>Policy: Evaluate command against allowlist
    alt Command not in allowlist
        Policy-->>Node: Deny
        Node-->>GW: exec.denied { reason: "not in allowlist" }
        GW->>Audit: Log denied exec (command, agentId)
        GW-->>RT: Error: command not allowed
        RT-->>Agent: Tool error
    end

    Policy->>Policy: Check deny patterns
    alt Matches deny pattern
        Policy-->>Node: Deny (deny overrides allow)
        Node-->>GW: exec.denied { reason: "deny pattern match" }
        GW->>Audit: Log denied exec
        GW-->>RT: Error: command denied
        RT-->>Agent: Tool error
    end

    Policy->>Policy: Validate args & cwd patterns
    alt Args or cwd out of scope
        Policy-->>Node: Deny
        Node-->>GW: exec.denied { reason: "scope violation" }
        GW->>Audit: Log denied exec
        GW-->>RT: Error: scope violation
        RT-->>Agent: Tool error
    end

    Policy-->>Node: Allow
    Node->>Node: execFile(command, argsArray)<br/>No shell interpolation
    Node-->>GW: exec.result { stdout, stderr, exitCode }
    GW->>Audit: Log exec (command, args, exitCode, agentId, deviceId)
    GW-->>RT: exec.result
    RT-->>Agent: Tool result
```

## Plugin Loading & Sandboxing

Plugins follow a two-tier trust model. Built-in plugins run in the main process with full access, while third-party plugins are isolated in sandboxed child processes with restricted permissions. Unsigned third-party plugins require explicit operator confirmation before loading. Each plugin declares a permission manifest specifying which capabilities it needs (`fs_read`, `fs_write`, `network`, `exec`, `privileged_hooks`), and any undeclared access is blocked at the runtime level. Resource limits (timeouts and memory caps) prevent runaway plugins from affecting system stability.

```mermaid
sequenceDiagram
    actor Operator
    participant GW as Gateway
    participant Loader as Plugin Loader
    participant Sandbox as Child Process
    participant Audit as audit.jsonl

    Operator->>GW: Load plugin { pluginId, source }
    GW->>Loader: Resolve plugin

    Loader->>Loader: Determine trust tier
    alt Built-in plugin
        Loader->>GW: Load in main process (full trust)
        GW->>Audit: Log plugin loaded (built-in)
    else Third-party plugin
        Loader->>Loader: Verify signature
        alt Unsigned plugin
            Loader-->>Operator: Prompt: allow unsigned plugin?
            alt Operator denies
                Loader->>Audit: Log plugin rejected (unsigned)
                Loader-->>GW: Plugin not loaded
            else Operator confirms
                Loader->>Loader: Proceed with sandbox
            end
        end

        Loader->>Sandbox: Spawn child process<br/>--experimental-permission<br/>--max-old-space-size
        Sandbox->>Sandbox: Apply permission manifest

        Note over Sandbox: fs_read/fs_write → declared paths only<br/>network → declared hosts only<br/>exec → if declared<br/>privileged_hooks → if declared

        alt Undeclared access attempt
            Sandbox-->>Loader: Permission denied
            Loader->>Audit: Log permission violation (pluginId, permission)
        end

        alt Plugin registers privileged hook without permission
            Sandbox-->>Loader: Hook registration denied
            Loader->>Audit: Log hook violation (pluginId)
        end

        Sandbox-->>GW: Plugin ready
        GW->>Audit: Log plugin loaded (third-party, permissions)
    end
```

## File Access & Path Traversal Prevention

File operations are constrained to each agent's designated workspace directory (`~/.homeagent/agents/{agentId}/`). Every file path is first checked for dangerous characters (`/`, `\`, `..`, null bytes) in identifiers, then resolved to its canonical form via `fs.realpath()` and verified against the allowed workspace prefix. Symlink escape attempts — where a symlink inside the workspace points to a location outside it — are detected and rejected. All traversal and escape violations are logged to the audit trail for forensic review.

```mermaid
sequenceDiagram
    actor Agent
    participant RT as Runtime
    participant FS as File Tool
    participant OS as Filesystem
    participant Audit as audit.jsonl

    Agent->>RT: Tool call: readFile(path)
    RT->>FS: Validate path

    FS->>FS: Check agentId/sessionId for<br/>/, \\, .., null bytes
    alt Invalid characters
        FS-->>RT: Reject: invalid identifier
        RT-->>Agent: Tool error
    end

    FS->>OS: fs.realpath(path)
    OS-->>FS: Resolved canonical path

    FS->>FS: Verify prefix: ~/.homeagent/agents/{agentId}/
    alt Path outside workspace
        FS-->>RT: Reject: path traversal
        FS->>Audit: Log path traversal attempt (agentId, path)
        RT-->>Agent: Tool error
    end

    FS->>FS: Check for symlink escape
    alt Symlink resolves outside workspace
        FS-->>RT: Reject: symlink escape
        FS->>Audit: Log symlink escape attempt
        RT-->>Agent: Tool error
    end

    FS->>OS: Read file
    OS-->>FS: File contents
    FS-->>RT: File contents
    RT-->>Agent: Tool result
```

## Device Revocation & Incident Response

When a security incident is detected, operators can respond immediately through the CLI without system downtime. Revoking a compromised device terminates all of its active connections and invalidates every associated token in a single atomic operation. Leaked credentials can be rotated and re-encrypted seamlessly. Malicious plugins can be killed instantly. The audit trail provides a real-time stream of security events to support investigation and post-incident analysis.

```mermaid
sequenceDiagram
    actor Operator
    participant CLI as CLI
    participant GW as Gateway
    participant Auth as Auth Module
    participant Sessions as Session Store
    participant Audit as audit.jsonl

    Note over Operator,Audit: Compromised device detected

    Operator->>CLI: device revoke {deviceId}
    CLI->>GW: device.revoke { deviceId }
    GW->>Auth: Revoke device approval
    Auth->>Auth: Remove from approved devices
    Auth->>Sessions: Find all sessions for deviceId
    Sessions-->>Auth: Active sessions list

    loop Each active session
        Auth->>GW: Terminate connection
        GW-->>GW: Close WebSocket
    end

    Auth->>Auth: Invalidate all tokens for deviceId
    GW->>Audit: Log device revoked (deviceId, operator)
    GW-->>CLI: device.revoked

    Note over Operator,Audit: Rotate leaked credentials

    Operator->>CLI: secrets rotate
    CLI->>GW: secrets.rotate
    GW->>GW: Re-encrypt provider tokens<br/>& API keys with new key
    GW->>Audit: Log secrets rotated (operator)
    GW-->>CLI: secrets.rotated (no downtime)

    Note over Operator,Audit: Disable malicious plugin

    Operator->>CLI: plugin disable {pluginId}
    CLI->>GW: plugin.disable { pluginId }
    GW->>GW: Kill plugin child process
    GW->>Audit: Log plugin disabled (pluginId, operator)
    GW-->>CLI: plugin.disabled

    Note over Operator,Audit: Review audit trail

    Operator->>CLI: audit tail
    CLI->>Audit: Stream recent entries
    Audit-->>CLI: Security events
    CLI-->>Operator: Display events
```

## Secret Storage & Redaction

Sensitive credentials (provider tokens, LLM API keys, device shared secrets) are encrypted at rest using the OS keychain or AES-256 with a master passphrase, and stored with restrictive file permissions (`0600`). Credentials are decrypted only in-memory when needed and are never written to application logs. Pino's redaction paths automatically strip prompts, tool arguments, tokens, and API keys from all log output. The audit log similarly records only event metadata (actor, timestamp, event type, outcome) with sensitive data redacted by default.

```mermaid
sequenceDiagram
    participant Config as Config / CLI
    participant Secrets as Secrets Store<br/>~/.homeagent/secrets/
    participant Keychain as OS Keychain / AES-256
    participant App as Application
    participant Pino as Pino Logger
    participant Audit as audit.jsonl

    Config->>Keychain: Store provider token / API key
    Keychain->>Secrets: Write encrypted (file perms 0600)

    App->>Secrets: Request credential
    Secrets->>Keychain: Decrypt
    Keychain-->>Secrets: Plaintext credential
    Secrets-->>App: Credential (in-memory only)

    App->>Pino: Log operation
    Pino->>Pino: Apply redaction paths<br/>(prompts, tool args, tokens, API keys)
    Pino-->>Pino: Redacted log entry

    Note over Pino: Secrets NEVER appear<br/>in application logs

    App->>Audit: Log security event
    Note over Audit: Actor, timestamp, event type, outcome<br/>Sensitive data redacted
```
