# Security Architecture

This document provides visual workflows for the HomeAgent security model. For full details, see [plan.combined.md](./plan.combined.md) § Security Considerations.

---

## Device Authentication & Session Flow

```mermaid
flowchart TD
    A[Device connects via WebSocket/TLS] --> B{Origin allowed?}
    B -- No --> C[Reject connection]
    B -- Yes --> D{Rate limit exceeded?}
    D -- Yes --> E[Return 429]
    D -- No --> F[Device sends connect handshake]
    F --> G{HMAC signature valid?\ndeviceId + nonce + timestamp}
    G -- No --> H[Reject — log to audit.jsonl]
    G -- Yes --> I{Nonce already used?}
    I -- Yes --> J[Reject replay — log to audit.jsonl]
    I -- No --> K{Device approved?}
    K -- No --> L[Reject unapproved device]
    K -- Yes --> M[Issue short-lived session token]
    M --> N[Device authenticated]
    N --> O[Heartbeat refreshes token]
```

## RPC Authorization (RBAC)

```mermaid
flowchart TD
    A[Incoming RPC request] --> B{Session token valid & not expired?}
    B -- No --> C[Reject — 401 Unauthorized]
    B -- Yes --> D[Validate request against Zod schema]
    D -- Invalid --> E[Reject — malformed input]
    D -- Valid --> F{Role permitted for this method?}
    F -- No --> G[Reject — 403 Forbidden\nLog to audit.jsonl]
    F -- Yes --> H{Idempotency key duplicate?}
    H -- Yes --> I[Return cached result]
    H -- No --> J[Execute RPC handler]

    subgraph Role Matrix
        direction LR
        R1[client role] -. "cannot call" .-> R2[node.exec.approve\ndevice.revoke]
        R3[node role] -. "cannot call" .-> R4[agent.run\nmessage.send]
    end
```

## Input Validation & Injection Prevention

```mermaid
flowchart TD
    A[Incoming input] --> B{Contains /, \\, .., or null bytes?}
    B -- Yes --> C[Reject agentId/sessionId]
    B -- No --> D{File path request?}
    D -- Yes --> E[fs.realpath + prefix check]
    E --> F{Within allowed workspace?}
    F -- No --> G[Reject path traversal]
    F -- Yes --> H{Symlink escape?}
    H -- Yes --> I[Reject symlink escape]
    H -- No --> J[Allow file access]
    D -- No --> K{Command execution?}
    K -- Yes --> L[execFile with array args\nNo shell interpolation]
    L --> M[Execute safely]
    K -- No --> N[Pass to handler]
```

## Exec Approval Flow

```mermaid
flowchart TD
    A[Agent requests node.exec] --> B{Command in allowlist?}
    B -- No --> C[Reject — log to audit.jsonl]
    B -- Yes --> D{Matches a deny pattern?}
    D -- Yes --> E[Reject — deny overrides allow]
    D -- No --> F{Args and cwd match allowed patterns?}
    F -- No --> G[Reject — scope violation]
    F -- Yes --> H[Execute command on node]
    H --> I[Log command, args, exit code,\nrequesting agent/device to audit.jsonl]
```

## Plugin Security & Sandboxing

```mermaid
flowchart TD
    A[Plugin load requested] --> B{Built-in or third-party?}
    B -- Built-in --> C[Load in main process\nFull trust]
    B -- Third-party --> D{Plugin signed?}
    D -- No --> E[Require user confirmation]
    E -- Denied --> F[Reject plugin]
    E -- Confirmed --> G[Load in sandboxed child process]
    D -- Yes --> G
    G --> H[Apply permission manifest]

    H --> I{fs_read/fs_write declared?}
    I -- No --> J[Block filesystem access]
    I -- Yes --> K[Restrict to declared paths]

    H --> L{network declared?}
    L -- No --> M[Block outbound HTTP]
    L -- Yes --> N[Allow to declared hosts only]

    H --> O{privileged_hooks declared?}
    O -- No --> P[Block onContextAssembled\nonModelResponse]
    O -- Yes --> Q[Allow privileged hooks]

    G --> R[Enforce resource limits\ntimeout + memory cap]
```

## End-to-End Security Layering

```mermaid
flowchart LR
    subgraph Network
        TLS[TLS encryption]
        ORIGIN[Origin validation]
        RATE[Rate limiting]
        SIZE[Frame size limits]
    end

    subgraph Authentication
        HMAC[HMAC challenge]
        NONCE[Nonce replay protection]
        TOKEN[Session tokens]
    end

    subgraph Authorization
        RBAC[Role-based access]
        ZOD[Zod schema validation]
        IDEMP[Idempotency keys]
    end

    subgraph Data Protection
        SECRETS[Encrypted secrets\nOS keychain / AES-256]
        REDACT[Log redaction\npino redaction paths]
        ISOLATION[Session isolation\nper-sender DM]
    end

    subgraph Sandboxing
        WORKSPACE[Agent workspace isolation]
        PLUGIN_SANDBOX[Plugin child process\nsandbox]
        EXEC_ALLOW[Exec allowlists\ndeny precedence]
        RESOURCE[Resource limits\ntimeouts + memory]
    end

    subgraph Audit
        LOG[Immutable audit.jsonl]
        CLI_IR[Incident response CLI\nrevoke / disable / rotate]
        HOOKS[Monitoring hooks\nanomaly alerting]
    end

    Network --> Authentication --> Authorization --> Data Protection --> Sandboxing --> Audit
```

## Incident Response

```mermaid
flowchart TD
    A[Security event detected] --> B[Logged to audit.jsonl]
    B --> C{Event type?}
    C -- Compromised device --> D[CLI: device revoke\nTerminate all connections]
    C -- Malicious plugin --> E[CLI: plugin disable\nKill child process]
    C -- Active session threat --> F[CLI: sessions kill\nInvalidate tokens]
    C -- Leaked credentials --> G[CLI: secrets rotate\nRe-encrypt without downtime]
    C -- Review needed --> H[CLI: audit tail\nStream recent events]
    D & E & F & G & H --> I[Monitoring hooks\nalert on anomalies]
```
