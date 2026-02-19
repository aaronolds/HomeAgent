# HomeAgent Security Implementation Plan

## Executive Summary

This plan addresses three critical security concerns for HomeAgent:
1. **Mitigating native system access risks** through fine-grained permission controls
2. **Running in isolated environments** with Docker container support
3. **Implementing fine-grained permission controls** for tool/skill execution

The repository is in early development stage with scaffolded packages but no implementation yet. This provides an opportunity to build security features from the ground up. The existing architecture documentation already includes comprehensive security design patterns that need to be implemented.

---

## Current State Analysis

### Repository Structure
- **Monorepo**: pnpm workspace with 10+ packages (gateway, runtime, tools, plugins, etc.)
- **Language**: TypeScript/Node.js 22 LTS
- **Architecture**: Multi-layered security design documented in `/docs/plan.combined.md`
- **Implementation Status**: All packages are minimal stubs with only package name exports

### Existing Security Design (Documented but Not Implemented)
The architecture includes:
- **RBAC**: Role-based access control (client/node/admin)
- **Device Authentication**: HMAC-based pairing with nonce replay protection
- **Exec Approval**: JSON allowlist for command execution
- **Plugin Sandboxing**: Node.js `--experimental-permission` flag for third-party plugins
- **Path Traversal Protection**: `fs.realpath()` + prefix validation
- **Shell Injection Prevention**: `execFile` with array args (no shell interpolation)
- **Audit Logging**: Immutable append-only `~/.homeagent/audit.jsonl`
- **Secrets Encryption**: OS keychain (`keytar`) or AES-256 with master passphrase

### Security Gaps to Address
1. **No container isolation support** - no Docker configuration exists
2. **No permission management system** - tool/skill allowlist/denylist not implemented
3. **No runtime sandboxing** - tool execution happens without resource limits
4. **No capability-based security** - tools don't declare required capabilities

---

## Implementation Plan

### Phase 1: Permission System Foundation

#### 1.1 Tool Capability Declaration System

**Objective**: Define what system resources each tool requires before execution.

**Files to Create**:

```
packages/shared/src/capabilities.ts
packages/shared/src/schemas/tool-manifest.ts
packages/shared/src/schemas/permission-policy.ts
```

**Implementation Details**:

**`packages/shared/src/capabilities.ts`**
- Define capability types enum:
  - `FILESYSTEM_READ` - read files within workspace
  - `FILESYSTEM_WRITE` - write files within workspace
  - `FILESYSTEM_READ_SYSTEM` - read files outside workspace (dangerous)
  - `FILESYSTEM_WRITE_SYSTEM` - write files outside workspace (dangerous)
  - `NETWORK_OUTBOUND` - make HTTP/HTTPS requests
  - `NETWORK_INBOUND` - listen on ports
  - `PROCESS_SPAWN` - spawn child processes
  - `PROCESS_EXEC` - execute system commands
  - `ENVIRONMENT_READ` - read environment variables
  - `ENVIRONMENT_WRITE` - modify environment
  - `IPC` - inter-process communication
  - `CLIPBOARD_READ` - access clipboard
  - `CLIPBOARD_WRITE` - write to clipboard
  - `SCREEN_CAPTURE` - capture screenshots
  - `CAMERA` - access camera
  - `MICROPHONE` - access microphone
  - `LOCATION` - access geolocation
  - `PRIVILEGED_CONTEXT` - access to conversation context (onContextAssembled hook)

**`packages/shared/src/schemas/tool-manifest.ts`**
- Zod schema for tool registration:
```typescript
{
  name: string,
  version: string,
  description: string,
  category: "filesystem" | "execution" | "network" | "browser" | "system" | "plugin",
  requiredCapabilities: Capability[],
  optionalCapabilities: Capability[],
  dangerLevel: "safe" | "low" | "medium" | "high" | "critical",
  networkHosts?: string[], // Required if NETWORK_OUTBOUND capability
  filesystemPaths?: string[], // Required if FILESYSTEM_* capabilities
  auditLogLevel: "none" | "minimal" | "standard" | "verbose"
}
```

**`packages/shared/src/schemas/permission-policy.ts`**
- Zod schema for agent/device permission policies:
```typescript
{
  version: 1,
  agentId: string,
  deviceId?: string, // Optional: per-device override
  mode: "allowlist" | "denylist" | "prompt",
  
  capabilities: {
    allowed: Capability[],
    denied: Capability[],
    prompt: Capability[] // Require interactive approval
  },
  
  tools: {
    allowed: string[], // Tool names
    denied: string[],
    prompt: string[]
  },
  
  categories: {
    allowed: ToolCategory[],
    denied: ToolCategory[],
    prompt: ToolCategory[]
  },
  
  networkPolicy: {
    mode: "deny" | "allowlist",
    allowedHosts: string[], // Glob patterns: "*.example.com", "192.168.*"
    deniedHosts: string[]
  },
  
  filesystemPolicy: {
    mode: "workspace-only" | "allowlist",
    allowedPaths: string[], // Outside workspace
    deniedPaths: string[] // Deny takes precedence
  },
  
  executionPolicy: {
    allowShell: boolean,
    allowedCommands: Array<{
      command: string,
      args?: string[], // Glob patterns: "*", "run *"
      cwd?: string[]
    }>,
    deniedCommands: string[],
    maxExecutionTime: number, // seconds
    maxConcurrent: number
  },
  
  resourceLimits: {
    maxMemoryMB: number,
    maxCPUPercent: number,
    maxFileSize: number, // bytes
    maxNetworkBytesPerMin: number
  },
  
  auditPolicy: {
    logLevel: "none" | "minimal" | "standard" | "verbose",
    logSensitiveData: boolean
  }
}
```

**Files to Modify**:
- `packages/shared/src/index.ts` - Export new types and schemas

**Testing Strategy**:
- Schema validation tests for all policy permutations
- Ensure deny precedence over allow
- Test glob pattern matching for hosts/commands

---

#### 1.2 Permission Checker Service

**Objective**: Runtime validation of tool execution against policies.

**Files to Create**:

```
packages/runtime/src/security/permission-checker.ts
packages/runtime/src/security/policy-loader.ts
packages/runtime/src/security/capability-resolver.ts
```

**Implementation Details**:

**`packages/runtime/src/security/permission-checker.ts`**
- Class `PermissionChecker`:
  - `checkToolExecution(toolName, params, context)` → `PermissionResult`
  - `checkCapability(capability, context)` → `PermissionResult`
  - `checkNetworkAccess(host, context)` → `PermissionResult`
  - `checkFilesystemAccess(path, mode, context)` → `PermissionResult`
  - `checkCommandExecution(command, args, context)` → `PermissionResult`

- Return type `PermissionResult`:
```typescript
{
  allowed: boolean,
  reason?: string,
  matchedRule?: string,
  requiresPrompt: boolean,
  dangerLevel: string,
  auditEntry: AuditEntry
}
```

**`packages/runtime/src/security/policy-loader.ts`**
- Load policies from:
  - `~/.homeagent/policies/default.json` (global)
  - `~/.homeagent/agents/<agentId>/policy.json` (per-agent)
  - `~/.homeagent/devices/<deviceId>/policy.json` (per-device)
- Policy inheritance: device → agent → global
- Hot-reload policies on file change (watch with `fs.watch`)
- Validate policies with Zod schemas on load
- Cache compiled glob patterns for performance

**`packages/runtime/src/security/capability-resolver.ts`**
- Map tool parameters to required capabilities:
  - File path parameters → `FILESYSTEM_*` capabilities
  - URL parameters → `NETWORK_OUTBOUND` capability
  - Command parameters → `PROCESS_EXEC` capability
- Detect implicit capabilities from tool behavior
- Build capability dependency graph for complex tools

**Testing Strategy**:
- Unit tests for each permission check scenario
- Test policy inheritance and override behavior
- Benchmark policy evaluation performance (<1ms per check)
- Test concurrent policy reloads

---

#### 1.3 Tool Registration with Capability Declaration

**Objective**: Require all tools to declare capabilities at registration time.

**Files to Create**:

```
packages/tools/src/registry/tool-registry.ts
packages/tools/src/base/tool-base.ts
packages/tools/src/decorators/capability.ts
```

**Implementation Details**:

**`packages/tools/src/registry/tool-registry.ts`**
- Singleton registry for tool definitions
- `registerTool(manifest, handler)` - validate manifest, store tool
- `getTool(name)` → tool definition + handler
- `listTools(category?)` → tool manifests
- `validateToolManifest(manifest)` - Zod validation
- Reject tools without capability declarations (fail-closed)

**`packages/tools/src/base/tool-base.ts`**
- Abstract base class for tools:
```typescript
abstract class ToolBase {
  abstract readonly manifest: ToolManifest;
  abstract execute(params: unknown, context: ToolContext): Promise<ToolResult>;
  
  protected requireCapability(cap: Capability): void {
    // Runtime check that capability was declared
  }
  
  protected checkPermission(action: string): PermissionResult {
    // Delegate to PermissionChecker
  }
}
```

**`packages/tools/src/decorators/capability.ts`**
- TypeScript decorators for capability declaration:
```typescript
@RequiresCapability(Capability.FILESYSTEM_READ)
@DangerLevel("low")
@Category("filesystem")
class FileReadTool extends ToolBase { ... }
```

**Files to Create (Core Tools)**:

```
packages/tools/src/builtin/filesystem/read-file.ts
packages/tools/src/builtin/filesystem/write-file.ts
packages/tools/src/builtin/filesystem/list-directory.ts
packages/tools/src/builtin/execution/run-command.ts
packages/tools/src/builtin/execution/run-script.ts
packages/tools/src/builtin/network/http-request.ts
packages/tools/src/builtin/browser/navigate.ts
packages/tools/src/builtin/browser/screenshot.ts
```

Each tool must implement:
- Capability declaration in manifest
- Path/command/host validation
- Resource limit enforcement
- Audit logging

**Testing Strategy**:
- Test tool registration validation
- Test capability requirement enforcement
- Test tool execution with various policies
- Integration tests with permission checker

---

#### 1.4 Runtime Enforcement Engine

**Objective**: Intercept and validate all tool executions at runtime.

**Files to Create**:

```
packages/runtime/src/execution/tool-executor.ts
packages/runtime/src/execution/execution-context.ts
packages/runtime/src/security/sandbox-manager.ts
```

**Implementation Details**:

**`packages/runtime/src/execution/tool-executor.ts`**
- Orchestrates tool execution with security checks:
```typescript
class ToolExecutor {
  async execute(toolName, params, context) {
    // 1. Load tool from registry
    // 2. Check permissions
    // 3. If prompt required, request user approval
    // 4. Create sandbox if needed
    // 5. Execute tool in sandbox
    // 6. Apply resource limits
    // 7. Monitor execution
    // 8. Audit log
    // 9. Return result or error
  }
}
```

**`packages/runtime/src/execution/execution-context.ts`**
- Context passed to tools during execution:
```typescript
{
  agentId: string,
  sessionId: string,
  deviceId: string,
  userId?: string,
  workspacePath: string,
  permissionPolicy: PermissionPolicy,
  requestId: string,
  timestamp: Date,
  parentToolCall?: string,
  resourceLimits: ResourceLimits
}
```

**`packages/runtime/src/security/sandbox-manager.ts`**
- Manage sandboxed tool execution:
  - For high-risk tools, spawn in child process
  - Apply resource limits (memory, CPU, time)
  - Use Node.js `--experimental-permission` flag
  - Restrict filesystem to workspace + allowed paths
  - Restrict network to allowed hosts
  - Kill process on timeout or resource violation
  - Capture stdout/stderr for audit

**Integration Points**:
- Hook into agent runtime loop (Phase 5 implementation)
- Call before every tool execution
- Block execution if permission denied
- Log all decisions to audit trail

**Testing Strategy**:
- Test permission checks block unauthorized tools
- Test sandbox process isolation
- Test resource limit enforcement
- Test timeout handling
- Test audit trail completeness

---

### Phase 2: Docker Container Isolation

#### 2.1 Docker Configuration

**Objective**: Enable HomeAgent to run in isolated Docker containers with minimal host access.

**Files to Create**:

```
Dockerfile
.dockerignore
docker-compose.yml
docker-compose.dev.yml
docker/
├── entrypoint.sh
├── healthcheck.sh
└── README.md
docs/deployment/docker.md
```

**Implementation Details**:

**`Dockerfile`** (Multi-stage build):
```dockerfile
# Stage 1: Build
FROM node:22-alpine AS builder
RUN corepack enable pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/*/package.json ./packages/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Stage 2: Production
FROM node:22-alpine
RUN corepack enable pnpm && \
    apk add --no-cache tini && \
    addgroup -g 1000 homeagent && \
    adduser -D -u 1000 -G homeagent homeagent

WORKDIR /app
COPY --from=builder --chown=homeagent:homeagent /app/packages/*/dist ./packages/
COPY --from=builder --chown=homeagent:homeagent /app/node_modules ./node_modules
COPY --from=builder --chown=homeagent:homeagent /app/package.json ./

# Create data directory
RUN mkdir -p /data/.homeagent && chown -R homeagent:homeagent /data

USER homeagent
VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node /app/docker/healthcheck.js

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "packages/gateway/dist/index.js"]
```

**`.dockerignore`**:
```
node_modules/
packages/*/dist/
packages/*/node_modules/
.git/
.vscode/
*.log
.env*
~/.homeagent/
```

**`docker-compose.yml`** (Production):
```yaml
version: '3.9'

services:
  homeagent:
    image: homeagent:latest
    build:
      context: .
      dockerfile: Dockerfile
    container_name: homeagent
    restart: unless-stopped
    
    # Security options
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE  # Only if binding to port 80/443
    read_only: true
    tmpfs:
      - /tmp:noexec,nosuid,size=100M
    
    # Resource limits
    mem_limit: 2g
    mem_reservation: 512m
    cpus: 2
    pids_limit: 100
    
    # Network isolation
    networks:
      - homeagent-internal
    ports:
      - "3000:3000"  # Gateway WebSocket port
    
    # Volumes
    volumes:
      - homeagent-data:/data
      - homeagent-logs:/app/logs:rw
    
    # Environment
    environment:
      - NODE_ENV=production
      - HOMEAGENT_DATA_DIR=/data/.homeagent
      - HOMEAGENT_LOG_LEVEL=info
      - HOMEAGENT_ENABLE_TELEMETRY=false
    
    # Healthcheck
    healthcheck:
      test: ["CMD", "node", "/app/docker/healthcheck.js"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s

volumes:
  homeagent-data:
    driver: local
  homeagent-logs:
    driver: local

networks:
  homeagent-internal:
    driver: bridge
    internal: false  # Set to true for complete network isolation
```

**`docker-compose.dev.yml`** (Development):
```yaml
version: '3.9'

services:
  homeagent-dev:
    build:
      context: .
      dockerfile: Dockerfile
      target: builder
    container_name: homeagent-dev
    volumes:
      - .:/app
      - /app/node_modules
      - homeagent-dev-data:/data
    environment:
      - NODE_ENV=development
      - HOMEAGENT_DATA_DIR=/data/.homeagent
      - HOMEAGENT_LOG_LEVEL=debug
    ports:
      - "3000:3000"
      - "9229:9229"  # Node.js debugger
    command: pnpm dev

volumes:
  homeagent-dev-data:
```

**`docker/entrypoint.sh`**:
```bash
#!/bin/sh
set -e

# Initialize data directory structure
mkdir -p "${HOMEAGENT_DATA_DIR}/agents"
mkdir -p "${HOMEAGENT_DATA_DIR}/secrets"
mkdir -p "${HOMEAGENT_DATA_DIR}/policies"
chmod 700 "${HOMEAGENT_DATA_DIR}/secrets"

# Generate default policy if not exists
if [ ! -f "${HOMEAGENT_DATA_DIR}/policies/default.json" ]; then
  cat > "${HOMEAGENT_DATA_DIR}/policies/default.json" <<EOF
{
  "version": 1,
  "mode": "allowlist",
  "capabilities": {
    "allowed": ["FILESYSTEM_READ", "FILESYSTEM_WRITE"],
    "denied": ["FILESYSTEM_READ_SYSTEM", "FILESYSTEM_WRITE_SYSTEM"],
    "prompt": ["PROCESS_EXEC", "NETWORK_OUTBOUND"]
  },
  "filesystemPolicy": {
    "mode": "workspace-only"
  }
}
EOF
fi

# Execute main command
exec "$@"
```

**`docker/healthcheck.sh`**:
```javascript
// Simple HTTP health check
import http from 'node:http';

const options = {
  host: 'localhost',
  port: 3000,
  path: '/health',
  timeout: 2000
};

const req = http.request(options, (res) => {
  process.exit(res.statusCode === 200 ? 0 : 1);
});

req.on('error', () => process.exit(1));
req.end();
```

**Testing Strategy**:
- Build image and verify size (<500MB)
- Test container starts and passes health check
- Test volume persistence across restarts
- Test resource limits are enforced
- Security scan with `docker scan` or Trivy
- Test network isolation modes

---

#### 2.2 Docker Security Hardening

**Objective**: Apply defense-in-depth for containerized deployments.

**Files to Create**:

```
docs/deployment/docker-security.md
.github/workflows/docker-security-scan.yml
docker/seccomp-profile.json
docker/apparmor-profile
```

**Implementation Details**:

**`docker/seccomp-profile.json`**:
- Whitelist only required syscalls
- Block dangerous syscalls: `ptrace`, `personality`, `mount`, `umount*`, `pivot_root`, `chroot`
- Reference Docker's default profile and restrict further

**`docker/apparmor-profile`**:
- Restrict file access to `/data` and `/app`
- Block access to `/proc/sys`, `/sys/firmware`
- Restrict network operations

**Updated `docker-compose.yml`** security additions:
```yaml
services:
  homeagent:
    security_opt:
      - no-new-privileges:true
      - seccomp=/path/to/seccomp-profile.json
      - apparmor=homeagent-profile
```

**`.github/workflows/docker-security-scan.yml`**:
```yaml
name: Docker Security Scan

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Build image
        run: docker build -t homeagent:test .
      
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: homeagent:test
          format: 'sarif'
          output: 'trivy-results.sarif'
      
      - name: Upload Trivy results to GitHub Security
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'
```

**`docs/deployment/docker-security.md`**:
- Document security best practices
- Explain volume permissions
- Network isolation strategies
- Secret management (Docker secrets vs env vars)
- Upgrading and patching guidance
- Incident response procedures

**Testing Strategy**:
- Verify seccomp profile blocks dangerous syscalls
- Test AppArmor profile enforcement
- Run automated security scans in CI
- Penetration testing from within container

---

#### 2.3 Container Orchestration Support

**Objective**: Support Kubernetes and other orchestration platforms.

**Files to Create**:

```
k8s/
├── namespace.yaml
├── deployment.yaml
├── service.yaml
├── configmap.yaml
├── secret.yaml
├── pvc.yaml
├── rbac.yaml
├── network-policy.yaml
└── pod-security-policy.yaml
docs/deployment/kubernetes.md
```

**Implementation Details**:

**`k8s/deployment.yaml`**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: homeagent
  namespace: homeagent
spec:
  replicas: 1  # Single instance for now (state management needed for scaling)
  strategy:
    type: Recreate  # Ensure only one instance at a time
  selector:
    matchLabels:
      app: homeagent
  template:
    metadata:
      labels:
        app: homeagent
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
        seccompProfile:
          type: RuntimeDefault
      
      containers:
      - name: homeagent
        image: homeagent:latest
        imagePullPolicy: Always
        
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop: [ALL]
        
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        
        ports:
        - containerPort: 3000
          name: websocket
          protocol: TCP
        
        env:
        - name: NODE_ENV
          value: production
        - name: HOMEAGENT_DATA_DIR
          value: /data/.homeagent
        
        volumeMounts:
        - name: data
          mountPath: /data
        - name: tmp
          mountPath: /tmp
        
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 30
        
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
      
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: homeagent-data
      - name: tmp
        emptyDir:
          sizeLimit: 100Mi
```

**`k8s/network-policy.yaml`**:
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: homeagent-network-policy
  namespace: homeagent
spec:
  podSelector:
    matchLabels:
      app: homeagent
  policyTypes:
  - Ingress
  - Egress
  
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx  # Only from ingress
    ports:
    - protocol: TCP
      port: 3000
  
  egress:
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 53  # DNS
    - protocol: UDP
      port: 53
  - to:
    - podSelector: {}
    ports:
    - protocol: TCP
      port: 443  # HTTPS for LLM APIs
```

**`k8s/pod-security-policy.yaml`**:
```yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: homeagent-psp
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'persistentVolumeClaim'
    - 'secret'
  hostNetwork: false
  hostIPC: false
  hostPID: false
  runAsUser:
    rule: MustRunAsNonRoot
  seLinux:
    rule: RunAsAny
  fsGroup:
    rule: RunAsAny
  readOnlyRootFilesystem: true
```

**Testing Strategy**:
- Deploy to test cluster
- Verify network policies block unauthorized traffic
- Test pod security policy enforcement
- Test resource limits
- Test persistence across pod restarts

---

### Phase 3: Advanced Sandboxing and Capability Restrictions

#### 3.1 Enhanced Runtime Sandbox

**Objective**: Implement process-level sandboxing with OS-level primitives.

**Files to Create**:

```
packages/runtime/src/sandbox/isolate.ts
packages/runtime/src/sandbox/cgroup-manager.ts
packages/runtime/src/sandbox/seccomp-filter.ts
packages/runtime/src/sandbox/namespace-manager.ts
```

**Implementation Details**:

**`packages/runtime/src/sandbox/isolate.ts`**:
- Main sandbox orchestrator
- Spawns tools in isolated processes
- Applies all restrictions (cgroups, seccomp, namespaces)
- Monitors process health and resource usage
- Enforces timeouts and kills runaway processes

**`packages/runtime/src/sandbox/cgroup-manager.ts`**:
- Linux cgroups v2 integration (when available)
- Set memory limits: `memory.max`, `memory.high`
- Set CPU limits: `cpu.max`, `cpu.weight`
- Set I/O limits: `io.max`
- Monitor resource usage: `memory.current`, `cpu.stat`
- Kill process group on limit violation

**`packages/runtime/src/sandbox/seccomp-filter.ts`**:
- Generate seccomp-bpf filters based on tool requirements
- Block syscalls by category:
  - Filesystem: `unlink`, `rmdir`, `rename` (unless FILESYSTEM_WRITE)
  - Network: `socket`, `bind`, `connect` (unless NETWORK_*)
  - Process: `fork`, `execve`, `ptrace` (unless PROCESS_*)
- Use libseccomp (via native module or command-line tool)

**`packages/runtime/src/sandbox/namespace-manager.ts`**:
- Linux namespace isolation (requires root or user namespaces):
  - PID namespace: isolated process tree
  - Network namespace: isolated network stack
  - Mount namespace: isolated filesystem view
  - IPC namespace: isolated IPC
  - UTS namespace: isolated hostname
- For unprivileged execution, use `unshare` command
- Fallback to basic process isolation if namespaces unavailable

**Platform Support**:
- Full sandboxing: Linux with cgroups v2 and namespaces
- Partial sandboxing: macOS (resource limits only)
- Minimal sandboxing: Windows (process limits only)
- Document platform-specific capabilities in README

**Testing Strategy**:
- Test memory limit enforcement
- Test CPU limit enforcement
- Test syscall filtering
- Test namespace isolation
- Test cross-platform graceful degradation

---

#### 3.2 Tool Isolation Levels

**Objective**: Classify tools by isolation requirements and apply appropriate sandboxing.

**Files to Create**:

```
packages/shared/src/schemas/isolation-level.ts
packages/runtime/src/sandbox/isolation-strategy.ts
```

**Implementation Details**:

**`packages/shared/src/schemas/isolation-level.ts`**:
- Define isolation levels:
  - `NONE`: Run in main process (built-in, trusted tools)
  - `BASIC`: Child process with resource limits
  - `STANDARD`: Child process + seccomp + limited capabilities
  - `STRICT`: Full namespace isolation + minimal capabilities
  - `EXTERNAL`: External sandboxing (gVisor, Firecracker)

**`packages/runtime/src/sandbox/isolation-strategy.ts`**:
- Map tool danger level to isolation level:
  - `safe` → `NONE` or `BASIC`
  - `low` → `BASIC`
  - `medium` → `STANDARD`
  - `high` → `STRICT`
  - `critical` → `STRICT` or `EXTERNAL`
- Apply policy overrides (admin can force higher isolation)
- Select appropriate sandbox implementation

**Tool Manifest Updates**:
- Add `isolationLevel` field to tool manifests
- Tools can request minimum isolation level
- Runtime can enforce higher isolation based on policy

**Testing Strategy**:
- Test tool execution at each isolation level
- Verify isolation prevents privilege escalation
- Test performance impact of each level
- Test fallback to lower isolation on unsupported platforms

---

#### 3.3 Network Sandboxing

**Objective**: Fine-grained network access control at the tool level.

**Files to Create**:

```
packages/runtime/src/sandbox/network-proxy.ts
packages/runtime/src/sandbox/network-filter.ts
```

**Implementation Details**:

**`packages/runtime/src/sandbox/network-proxy.ts`**:
- HTTP/HTTPS proxy for sandboxed tools
- Intercept all outbound requests
- Check against network policy allowlist
- Block/allow based on host, port, protocol
- Log all network activity to audit trail
- Support for proxy environment variables

**`packages/runtime/src/sandbox/network-filter.ts`**:
- Implement network filtering strategies:
  - **DNS filtering**: Intercept DNS queries, block unauthorized domains
  - **IP filtering**: Use iptables/pf to block IPs (requires privileges)
  - **Network namespace**: Complete network isolation with veth pair
- Apply rate limits per tool/host
- Detect and block data exfiltration attempts

**Integration**:
- Tools with `NETWORK_OUTBOUND` capability get proxied network
- Tools without capability get no network access
- Transparent for well-behaved tools using standard HTTP clients

**Testing Strategy**:
- Test allowed hosts can be accessed
- Test blocked hosts are rejected
- Test DNS filtering
- Test rate limiting
- Test with various HTTP clients (fetch, axios, curl)

---

#### 3.4 Filesystem Sandboxing

**Objective**: Enforce filesystem boundaries with OS-level primitives.

**Files to Create**:

```
packages/runtime/src/sandbox/filesystem-jail.ts
packages/runtime/src/sandbox/mount-manager.ts
```

**Implementation Details**:

**`packages/runtime/src/sandbox/filesystem-jail.ts`**:
- Filesystem isolation strategies:
  - **chroot**: Change root directory to workspace (requires root)
  - **bind mount**: Mount workspace as read-only/read-write (Linux)
  - **Path filtering**: Intercept filesystem operations and validate paths
- Prevent escape via symlinks:
  - Resolve symlinks with `fs.realpath()`
  - Reject symlinks pointing outside workspace
  - Use `O_NOFOLLOW` flag when opening files
- Prevent TOCTOU attacks:
  - Open file by fd, then verify path
  - Use `fstat` instead of `stat`

**`packages/runtime/src/sandbox/mount-manager.ts`**:
- Linux mount namespace management:
  - Create minimal filesystem tree
  - Mount only required directories read-only
  - Mount workspace as read-write
  - Mount `/tmp` as tmpfs with size limit
  - Unmount sensitive paths: `/proc/sys`, `/sys/firmware`
- Use `MS_NOSUID`, `MS_NODEV`, `MS_NOEXEC` flags

**Path Validation**:
- All filesystem operations go through validation:
```typescript
function validatePath(path: string, workspace: string): string {
  const resolved = fs.realpathSync(path);
  if (!resolved.startsWith(workspace)) {
    throw new SecurityError('Path traversal detected');
  }
  return resolved;
}
```

**Testing Strategy**:
- Test path traversal attempts are blocked
- Test symlink escape attempts are blocked
- Test TOCTOU race conditions
- Test read-only enforcement
- Test workspace isolation

---

### Phase 4: Configuration and Management

#### 4.1 Permission Policy Management CLI

**Objective**: User-friendly CLI for managing permission policies.

**Files to Create**:

```
packages/cli/src/commands/policy/
├── init.ts
├── list.ts
├── show.ts
├── edit.ts
├── validate.ts
├── allow.ts
├── deny.ts
├── reset.ts
└── export.ts
```

**Implementation Details**:

**Commands**:
```bash
# Initialize default policy
homeagent policy init [--agent <agentId>] [--device <deviceId>]

# List all policies
homeagent policy list

# Show specific policy
homeagent policy show <policyId>

# Edit policy (opens in $EDITOR)
homeagent policy edit <policyId>

# Validate policy file
homeagent policy validate <path>

# Quick allow/deny operations
homeagent policy allow tool <toolName> [--agent <agentId>]
homeagent policy deny tool <toolName> [--agent <agentId>]
homeagent policy allow capability <capability> [--agent <agentId>]
homeagent policy deny capability <capability> [--agent <agentId>]

# Reset to default
homeagent policy reset <policyId>

# Export policy for sharing
homeagent policy export <policyId> --output <path>
```

**Interactive Mode**:
- Use inquirer.js for interactive policy creation
- Guide user through capability selection
- Suggest safe defaults based on agent purpose
- Validate input in real-time

**Testing Strategy**:
- Test each command with valid/invalid input
- Test policy validation
- Test policy updates are applied immediately
- Integration tests with runtime

---

#### 4.2 Runtime Permission Prompts

**Objective**: Interactive approval for tools requiring prompt-level permission.

**Files to Create**:

```
packages/runtime/src/security/approval-manager.ts
packages/gateway/src/events/approval-request.ts
packages/cli/src/commands/approve.ts
```

**Implementation Details**:

**`packages/runtime/src/security/approval-manager.ts`**:
- Queue approval requests when tool requires prompt
- Emit approval request event to connected clients
- Wait for user approval (with timeout)
- Cache approvals (session-scoped or permanent)
- Support "always allow" and "always deny" responses

**Approval Request Event**:
```typescript
{
  type: 'approval_request',
  requestId: string,
  agentId: string,
  sessionId: string,
  timestamp: Date,
  tool: string,
  capability: Capability,
  dangerLevel: string,
  reason: string,
  parameters: Record<string, unknown>,
  suggestedAction: 'allow' | 'deny',
  timeout: number // seconds
}
```

**CLI Approval Flow**:
```bash
# Manual approval
homeagent approve <requestId> [--allow|--deny] [--always]

# Auto-approve specific tool for session
homeagent approve auto --tool <toolName> --session <sessionId>

# List pending approvals
homeagent approve list

# Revoke cached approval
homeagent approve revoke --tool <toolName> --agent <agentId>
```

**Testing Strategy**:
- Test approval request emission
- Test timeout handling
- Test approval caching
- Test "always allow" persistence
- Test concurrent approval requests

---

#### 4.3 Security Dashboard and Monitoring

**Objective**: Visibility into security events and policy enforcement.

**Files to Create**:

```
packages/cli/src/commands/security/
├── dashboard.ts
├── audit.ts
├── violations.ts
└── stats.ts
```

**Implementation Details**:

**Commands**:
```bash
# Security dashboard (live)
homeagent security dashboard

# Audit log viewer
homeagent security audit [--follow] [--filter <type>] [--agent <agentId>]

# List security violations
homeagent security violations [--since <date>] [--severity <level>]

# Security statistics
homeagent security stats [--agent <agentId>] [--period <days>]
```

**Dashboard Output** (terminal UI with blessed/ink):
- Active sessions count
- Tools executed (last hour)
- Permission denials (last hour)
- Security violations (last 24h)
- Resource usage per agent
- Network activity per agent
- Top tools by execution count
- Recent approval requests

**Audit Log Viewer**:
- Stream `~/.homeagent/audit.jsonl` in real-time
- Colored output by event type
- Filter by agent, device, tool, capability
- Export filtered logs

**Testing Strategy**:
- Test dashboard updates in real-time
- Test log filtering
- Test statistics accuracy
- Performance test with large audit logs

---

### Phase 5: Documentation and Examples

#### 5.1 Security Documentation

**Files to Create**:

```
docs/security/
├── README.md
├── threat-model.md
├── permission-system.md
├── docker-deployment.md
├── hardening-guide.md
├── incident-response.md
└── security-faq.md
```

**Content Outline**:

**`README.md`**: Overview of security architecture

**`threat-model.md`**:
- Assets: user data, credentials, host system
- Threat actors: malicious tools, compromised LLM, network attackers
- Attack vectors: prompt injection, path traversal, command injection
- Mitigations: how each security layer addresses threats

**`permission-system.md`**:
- Capability types and meanings
- Policy syntax and examples
- Inheritance and precedence rules
- Best practices for policy design

**`docker-deployment.md`**:
- Security benefits of containers
- Configuration options
- Network isolation strategies
- Secret management
- Upgrading and patching

**`hardening-guide.md`**:
- Recommended security settings
- OS-level hardening (Linux, macOS, Windows)
- Network security (firewall, VPN)
- Monitoring and alerting
- Security checklist

**`incident-response.md`**:
- Detecting security incidents
- Immediate response steps
- Forensics with audit logs
- Recovery procedures
- Post-incident analysis

**`security-faq.md`**:
- Common security questions
- Comparison with other AI agent frameworks
- Compliance considerations (GDPR, SOC2, etc.)

---

#### 5.2 Example Policies

**Files to Create**:

```
examples/policies/
├── strict.json
├── moderate.json
├── permissive.json
├── filesystem-only.json
├── network-only.json
├── no-execution.json
└── development.json
```

**Example Policy (strict.json)**:
```json
{
  "version": 1,
  "mode": "allowlist",
  "description": "Strict policy for untrusted agents - filesystem only",
  
  "capabilities": {
    "allowed": ["FILESYSTEM_READ", "FILESYSTEM_WRITE"],
    "denied": [
      "FILESYSTEM_READ_SYSTEM",
      "FILESYSTEM_WRITE_SYSTEM",
      "PROCESS_EXEC",
      "PROCESS_SPAWN",
      "NETWORK_OUTBOUND",
      "PRIVILEGED_CONTEXT"
    ],
    "prompt": []
  },
  
  "tools": {
    "allowed": ["read_file", "write_file", "list_directory"],
    "denied": ["run_command", "run_script", "http_request", "browser_*"],
    "prompt": []
  },
  
  "filesystemPolicy": {
    "mode": "workspace-only",
    "allowedPaths": [],
    "deniedPaths": []
  },
  
  "resourceLimits": {
    "maxMemoryMB": 512,
    "maxCPUPercent": 50,
    "maxFileSize": 10485760,
    "maxNetworkBytesPerMin": 0
  },
  
  "auditPolicy": {
    "logLevel": "verbose",
    "logSensitiveData": false
  }
}
```

---

#### 5.3 Integration Examples

**Files to Create**:

```
examples/
├── custom-tool-with-capabilities.ts
├── plugin-with-sandbox.ts
├── permission-aware-agent.ts
└── docker-compose-examples/
    ├── production-secure.yml
    ├── multi-agent-isolated.yml
    └── development-with-debugger.yml
```

**Example: Custom Tool with Capabilities**:
```typescript
// examples/custom-tool-with-capabilities.ts
import { ToolBase, RequiresCapability, DangerLevel } from '@homeagent/tools';
import { Capability } from '@homeagent/shared';

@RequiresCapability(Capability.NETWORK_OUTBOUND)
@DangerLevel('medium')
class WeatherTool extends ToolBase {
  readonly manifest = {
    name: 'weather',
    version: '1.0.0',
    description: 'Fetch weather information',
    category: 'network',
    requiredCapabilities: [Capability.NETWORK_OUTBOUND],
    networkHosts: ['api.weather.com'],
    dangerLevel: 'medium',
    auditLogLevel: 'standard'
  };
  
  async execute(params: { city: string }, context: ToolContext) {
    // Permission already checked by runtime
    const result = await this.checkPermission('network_outbound');
    if (!result.allowed) {
      throw new PermissionError(result.reason);
    }
    
    // Make API request (through network proxy)
    const weather = await fetch(`https://api.weather.com/${params.city}`);
    return weather.json();
  }
}
```

---

### Phase 6: Testing and Validation

#### 6.1 Security Test Suite

**Files to Create**:

```
packages/runtime/test/security/
├── permission-checker.test.ts
├── policy-enforcement.test.ts
├── path-traversal.test.ts
├── command-injection.test.ts
├── sandbox-isolation.test.ts
├── network-filtering.test.ts
└── resource-limits.test.ts
```

**Test Coverage**:

1. **Permission Checker Tests**:
   - Test allow/deny/prompt logic
   - Test policy inheritance
   - Test glob pattern matching
   - Test capability requirement validation

2. **Policy Enforcement Tests**:
   - Test tool execution blocked without permission
   - Test capability checks at runtime
   - Test policy hot-reload
   - Test concurrent policy access

3. **Path Traversal Tests**:
   - Test `../` escape attempts
   - Test symlink escape attempts
   - Test absolute path injection
   - Test null byte injection
   - Test TOCTOU race conditions

4. **Command Injection Tests**:
   - Test shell metacharacter injection
   - Test argument injection
   - Test environment variable injection
   - Test command chaining attempts

5. **Sandbox Isolation Tests**:
   - Test filesystem isolation
   - Test network isolation
   - Test process isolation
   - Test resource limit enforcement
   - Test escape attempts

6. **Network Filtering Tests**:
   - Test allowed hosts accessible
   - Test blocked hosts rejected
   - Test DNS filtering
   - Test rate limiting
   - Test proxy transparency

7. **Resource Limits Tests**:
   - Test memory limit enforcement
   - Test CPU limit enforcement
   - Test timeout enforcement
   - Test concurrent execution limits

**Test Requirements**:
- All tests must pass on Linux (full security features)
- Graceful degradation tests for macOS/Windows
- Performance benchmarks (<10ms overhead per tool execution)
- Integration tests with real tools

---

#### 6.2 Security Audit and Penetration Testing

**Files to Create**:

```
docs/security/
├── audit-log.md
├── penetration-test-plan.md
└── vulnerability-disclosure.md
```

**Audit Checklist**:
- [ ] All tools declare required capabilities
- [ ] Path traversal protection enforced
- [ ] Command injection prevention verified
- [ ] Network filtering operational
- [ ] Resource limits enforced
- [ ] Audit logging complete and immutable
- [ ] Secrets encrypted at rest
- [ ] Container security hardened
- [ ] RBAC enforced for all RPC methods
- [ ] Rate limiting prevents DoS

**Penetration Test Scenarios**:
1. Attempt to read files outside workspace
2. Attempt to execute unauthorized commands
3. Attempt to access unauthorized network hosts
4. Attempt to exhaust system resources
5. Attempt to escalate privileges from sandboxed tool
6. Attempt to inject malicious prompts
7. Attempt to exfiltrate data via covert channels

---

## Implementation Timeline

### Immediate (Weeks 1-2)
1. ✅ Create shared capability and policy schemas
2. ✅ Implement permission checker service
3. ✅ Create tool registry with capability validation
4. ✅ Implement basic policy loader

### Short-term (Weeks 3-4)
1. ✅ Implement tool executor with permission checks
2. ✅ Create Docker configuration
3. ✅ Implement basic sandboxing for high-risk tools
4. ✅ Create CLI commands for policy management

### Medium-term (Weeks 5-8)
1. ✅ Implement advanced sandboxing (cgroups, seccomp, namespaces)
2. ✅ Implement network proxy and filtering
3. ✅ Implement filesystem jail
4. ✅ Create approval manager and runtime prompts
5. ✅ Write security documentation

### Long-term (Weeks 9-12)
1. ✅ Create security dashboard and monitoring
2. ✅ Kubernetes deployment configurations
3. ✅ Comprehensive security test suite
4. ✅ Security audit and penetration testing
5. ✅ Example policies and integration guides

---

## Dependencies and Prerequisites

### Implementation Dependencies

**Must be completed before security implementation**:
- [ ] Issue #001: Monorepo scaffold and tooling
- [ ] Issue #002: Shared protocol schemas and contracts
- [ ] Issue #006: Persistence layer (SQLite, audit log)
- [ ] Issue #007: Runtime session and context assembly
- [ ] Issue #008: Runtime streaming and tool execution

**Can be implemented in parallel with security**:
- [ ] Issue #010: Plugin SDK and skills
- [ ] Issue #016: Config package

**Will consume security features**:
- [ ] Issue #011: Plugin sandbox and signing (extends this plan)
- [ ] Issue #014: Node exec approval (extends this plan)
- [ ] Issue #018: Security test suite (validates this plan)

### External Dependencies

**Required packages**:
```json
{
  "dependencies": {
    "zod": "^3.22.0",
    "glob": "^10.3.0",
    "minimatch": "^9.0.0"
  },
  "optionalDependencies": {
    "keytar": "^7.9.0",
    "libseccomp": "^1.0.0"
  }
}
```

**System requirements**:
- Linux: kernel 5.0+ for full sandboxing (cgroups v2, namespaces)
- macOS: 12+ for basic resource limits
- Windows: 10+ for basic process isolation
- Docker: 20.10+ for container support
- Node.js: 22+ with `--experimental-permission` flag

---

## Edge Cases and Open Questions

### Edge Cases to Handle

1. **Policy conflicts**: What happens when device policy conflicts with agent policy?
   - **Resolution**: Device policy takes precedence (most restrictive wins)

2. **Plugin capability inflation**: Plugin declares minimal capabilities but requires more at runtime
   - **Resolution**: Block and log violation; require plugin update

3. **Performance impact**: Permission checks on every tool execution
   - **Resolution**: Policy caching, compiled glob patterns, <1ms overhead target

4. **Approval timeout**: User doesn't respond to approval request
   - **Resolution**: Configurable timeout (default 5min), deny by default

5. **Resource limit bypass**: Tool spawns child processes to evade limits
   - **Resolution**: cgroups track entire process tree; monitor descendants

6. **Network proxy bypass**: Tool uses native bindings to bypass proxy
   - **Resolution**: Network namespace isolation; block raw sockets

7. **Docker in Docker**: Running HomeAgent in container, tools need Docker
   - **Resolution**: Socket mounting option; document security implications

8. **Symlink timing attacks**: Symlink changed between check and use
   - **Resolution**: Use file descriptors; open with O_NOFOLLOW

### Open Questions

1. **Scaling**: How to handle multiple agents with different policies?
   - **Approach**: Per-agent policy files with caching layer

2. **Policy versioning**: How to handle policy schema updates?
   - **Approach**: Version field in policy; migration tool

3. **Plugin trust**: Should we support signed plugins initially?
   - **Decision**: Optional in v1; unsigned require explicit confirmation

4. **External sandboxes**: Integration with gVisor, Firecracker?
   - **Decision**: Out of scope for v1; document as future enhancement

5. **Compliance**: GDPR, SOC2, HIPAA considerations?
   - **Approach**: Document compliance features; user responsible for configuration

6. **Performance**: What's acceptable overhead for security checks?
   - **Target**: <1ms for permission check, <100ms for sandbox spawn

7. **Backward compatibility**: How to handle policy changes?
   - **Approach**: Strict versioning; validate on load; migration tool

---

## Success Metrics

### Security Metrics

1. **Coverage**: 100% of tools require capability declaration
2. **Enforcement**: 100% of tool executions pass through permission checker
3. **Audit**: 100% of security decisions logged to audit trail
4. **Isolation**: 0 successful sandbox escapes in penetration testing
5. **Performance**: <1ms overhead for permission checks
6. **Usability**: Policy creation <5 minutes for new users

### Testing Metrics

1. **Unit tests**: 90%+ code coverage for security modules
2. **Integration tests**: All security scenarios covered
3. **Penetration tests**: 0 critical vulnerabilities
4. **Performance tests**: No degradation >5% with security enabled

### Documentation Metrics

1. **Completeness**: All security features documented
2. **Examples**: 5+ policy examples for common scenarios
3. **Tutorials**: Step-by-step guides for Docker deployment
4. **FAQ**: Address top 10 security questions

---

## Risk Assessment

### High Risk - Must Address

1. **Path traversal**: Critical vulnerability if not handled correctly
   - **Mitigation**: Multiple layers (validation, realpath, chroot/namespace)

2. **Command injection**: Can lead to full system compromise
   - **Mitigation**: `execFile` only, no shell, arg validation

3. **Privilege escalation**: Escape from sandbox to host
   - **Mitigation**: Drop privileges, seccomp, namespaces, container isolation

4. **Data exfiltration**: Malicious tool leaking user data
   - **Mitigation**: Network filtering, audit logging, capability restrictions

### Medium Risk - Should Address

1. **Resource exhaustion**: DoS through excessive resource consumption
   - **Mitigation**: Resource limits (cgroups), timeouts, rate limiting

2. **Policy bypass**: Misconfigured policy allowing unauthorized access
   - **Mitigation**: Fail-closed by default, policy validation, audit alerts

3. **Covert channels**: Data exfiltration via timing or error messages
   - **Mitigation**: Rate limiting, audit logging, monitoring

### Low Risk - Monitor

1. **Side-channel attacks**: Information leakage via performance characteristics
   - **Mitigation**: Document limitations, recommend network isolation

2. **Supply chain**: Compromised dependencies
   - **Mitigation**: Dependency scanning, lock files, security updates

---

## Conclusion

This security implementation plan provides a comprehensive, defense-in-depth approach to securing the HomeAgent platform. By implementing fine-grained permission controls, container isolation, and runtime sandboxing, we can significantly reduce the attack surface while maintaining usability.

The plan is designed to be implemented incrementally, with each phase building on the previous. Priority should be given to:

1. **Phase 1**: Permission system foundation (blocks unauthorized tool execution)
2. **Phase 2**: Docker container isolation (defense-in-depth layer)
3. **Phase 3**: Advanced sandboxing (prevents sandbox escapes)
4. **Phase 4**: Management tooling (makes security usable)

The modular design allows for platform-specific optimizations (full security on Linux, graceful degradation on macOS/Windows) while maintaining a consistent security model across deployments.

Next steps:
1. Review and approve this plan
2. Create GitHub issues for each phase
3. Assign implementation tasks
4. Begin with Phase 1.1 (capability declaration system)
