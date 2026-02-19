# HomeAgent Security Implementation Checklist

This document provides a concrete checklist of files to create or modify for implementing the security features described in `security-implementation-plan.md`.

## Quick Reference

- **Total New Files**: 97
- **Files to Modify**: 8
- **Estimated LOC**: ~15,000
- **Implementation Time**: 8-12 weeks (1-2 developers)

---

## Phase 1: Permission System Foundation

### 1.1 Tool Capability Declaration System

#### New Files to Create

- [ ] `packages/shared/src/capabilities.ts` (~200 LOC)
  - Capability enum definitions
  - Capability categories
  - Capability descriptions for UI

- [ ] `packages/shared/src/schemas/tool-manifest.ts` (~150 LOC)
  - Zod schema for ToolManifest
  - Validation functions
  - Type exports

- [ ] `packages/shared/src/schemas/permission-policy.ts` (~300 LOC)
  - Zod schema for PermissionPolicy
  - Policy validation logic
  - Default policy templates

- [ ] `packages/shared/src/types/capability.d.ts` (~100 LOC)
  - TypeScript type definitions
  - Capability interfaces
  - Policy interfaces

#### Files to Modify

- [ ] `packages/shared/src/index.ts`
  - Export new capability types
  - Export tool manifest schema
  - Export permission policy schema

#### Tests to Create

- [ ] `packages/shared/test/schemas/tool-manifest.test.ts` (~200 LOC)
- [ ] `packages/shared/test/schemas/permission-policy.test.ts` (~300 LOC)

---

### 1.2 Permission Checker Service

#### New Files to Create

- [ ] `packages/runtime/src/security/permission-checker.ts` (~400 LOC)
  - PermissionChecker class
  - checkToolExecution() method
  - checkCapability() method
  - checkNetworkAccess() method
  - checkFilesystemAccess() method
  - checkCommandExecution() method

- [ ] `packages/runtime/src/security/policy-loader.ts` (~300 LOC)
  - PolicyLoader class
  - Load policies from disk
  - Policy inheritance logic
  - Hot-reload with fs.watch
  - Policy caching

- [ ] `packages/runtime/src/security/capability-resolver.ts` (~250 LOC)
  - CapabilityResolver class
  - Map tool params to capabilities
  - Detect implicit capabilities
  - Build capability dependency graph

- [ ] `packages/runtime/src/security/types.ts` (~100 LOC)
  - PermissionResult interface
  - PermissionContext interface
  - SecurityError class

#### Files to Modify

- [ ] `packages/runtime/src/index.ts`
  - Export PermissionChecker
  - Export PolicyLoader

#### Tests to Create

- [ ] `packages/runtime/test/security/permission-checker.test.ts` (~500 LOC)
- [ ] `packages/runtime/test/security/policy-loader.test.ts` (~400 LOC)
- [ ] `packages/runtime/test/security/capability-resolver.test.ts` (~300 LOC)

---

### 1.3 Tool Registration with Capability Declaration

#### New Files to Create

- [ ] `packages/tools/src/registry/tool-registry.ts` (~300 LOC)
  - ToolRegistry singleton
  - registerTool() method
  - getTool() method
  - listTools() method
  - validateToolManifest()

- [ ] `packages/tools/src/base/tool-base.ts` (~200 LOC)
  - Abstract ToolBase class
  - execute() method signature
  - requireCapability() helper
  - checkPermission() helper

- [ ] `packages/tools/src/decorators/capability.ts` (~150 LOC)
  - @RequiresCapability decorator
  - @DangerLevel decorator
  - @Category decorator

- [ ] `packages/tools/src/types.ts` (~100 LOC)
  - ToolContext interface
  - ToolResult interface
  - ToolCategory enum

#### Built-in Tools

- [ ] `packages/tools/src/builtin/filesystem/read-file.ts` (~150 LOC)
- [ ] `packages/tools/src/builtin/filesystem/write-file.ts` (~150 LOC)
- [ ] `packages/tools/src/builtin/filesystem/list-directory.ts` (~150 LOC)
- [ ] `packages/tools/src/builtin/execution/run-command.ts` (~200 LOC)
- [ ] `packages/tools/src/builtin/execution/run-script.ts` (~200 LOC)
- [ ] `packages/tools/src/builtin/network/http-request.ts` (~200 LOC)
- [ ] `packages/tools/src/builtin/browser/navigate.ts` (~150 LOC)
- [ ] `packages/tools/src/builtin/browser/screenshot.ts` (~150 LOC)

#### Files to Modify

- [ ] `packages/tools/src/index.ts`
  - Export ToolRegistry
  - Export ToolBase
  - Export all builtin tools

#### Tests to Create

- [ ] `packages/tools/test/registry/tool-registry.test.ts` (~300 LOC)
- [ ] `packages/tools/test/builtin/filesystem/read-file.test.ts` (~200 LOC)
- [ ] `packages/tools/test/builtin/execution/run-command.test.ts` (~300 LOC)

---

### 1.4 Runtime Enforcement Engine

#### New Files to Create

- [ ] `packages/runtime/src/execution/tool-executor.ts` (~500 LOC)
  - ToolExecutor class
  - execute() orchestration method
  - Permission checking integration
  - Sandbox management integration
  - Resource monitoring
  - Audit logging

- [ ] `packages/runtime/src/execution/execution-context.ts` (~150 LOC)
  - ExecutionContext class
  - Context builders
  - Resource limit tracking

- [ ] `packages/runtime/src/security/sandbox-manager.ts` (~400 LOC)
  - SandboxManager class
  - Spawn sandboxed processes
  - Apply resource limits
  - Monitor execution
  - Kill on timeout/violation

#### Files to Modify

- [ ] `packages/runtime/src/index.ts`
  - Export ToolExecutor
  - Export ExecutionContext

#### Tests to Create

- [ ] `packages/runtime/test/execution/tool-executor.test.ts` (~600 LOC)
- [ ] `packages/runtime/test/security/sandbox-manager.test.ts` (~400 LOC)

---

## Phase 2: Docker Container Isolation

### 2.1 Docker Configuration

#### New Files to Create

- [ ] `Dockerfile` (~80 lines)
  - Multi-stage build
  - Security hardening
  - Non-root user
  - Volume definitions

- [ ] `.dockerignore` (~30 lines)
  - Exclude dev files
  - Exclude node_modules
  - Exclude secrets

- [ ] `docker-compose.yml` (~120 lines)
  - Production configuration
  - Security options
  - Resource limits
  - Network isolation

- [ ] `docker-compose.dev.yml` (~60 lines)
  - Development configuration
  - Volume mounts for hot reload
  - Debug port exposure

- [ ] `docker/entrypoint.sh` (~50 lines)
  - Initialize data directory
  - Generate default policies
  - Start services

- [ ] `docker/healthcheck.js` (~30 lines)
  - HTTP health check
  - Return status code

- [ ] `docker/README.md` (~200 lines)
  - Docker setup guide
  - Configuration options
  - Volume management
  - Troubleshooting

#### Tests to Create

- [ ] `.github/workflows/docker-build.yml` (~50 lines)
  - Build image on PR
  - Test image starts
  - Run smoke tests

---

### 2.2 Docker Security Hardening

#### New Files to Create

- [ ] `docker/seccomp-profile.json` (~300 lines)
  - Syscall allowlist
  - Block dangerous syscalls
  - Based on Docker default profile

- [ ] `docker/apparmor-profile` (~100 lines)
  - Filesystem restrictions
  - Network restrictions
  - Capability restrictions

- [ ] `.github/workflows/docker-security-scan.yml` (~60 lines)
  - Trivy security scan
  - Upload results to GitHub Security
  - Fail on high/critical vulnerabilities

- [ ] `docs/deployment/docker-security.md` (~500 lines)
  - Security best practices
  - Volume permissions guide
  - Network isolation strategies
  - Secret management
  - Incident response

---

### 2.3 Container Orchestration Support

#### New Files to Create

- [ ] `k8s/namespace.yaml` (~20 lines)
- [ ] `k8s/deployment.yaml` (~150 lines)
- [ ] `k8s/service.yaml` (~30 lines)
- [ ] `k8s/configmap.yaml` (~40 lines)
- [ ] `k8s/secret.yaml` (~30 lines)
- [ ] `k8s/pvc.yaml` (~40 lines)
- [ ] `k8s/rbac.yaml` (~80 lines)
- [ ] `k8s/network-policy.yaml` (~70 lines)
- [ ] `k8s/pod-security-policy.yaml` (~60 lines)
- [ ] `docs/deployment/kubernetes.md` (~800 lines)

---

## Phase 3: Advanced Sandboxing

### 3.1 Enhanced Runtime Sandbox

#### New Files to Create

- [ ] `packages/runtime/src/sandbox/isolate.ts` (~400 LOC)
  - Main sandbox orchestrator
  - Spawn isolated processes
  - Apply all restrictions
  - Monitor process health

- [ ] `packages/runtime/src/sandbox/cgroup-manager.ts` (~350 LOC)
  - Linux cgroups v2 integration
  - Set memory/CPU/IO limits
  - Monitor resource usage
  - Kill on violation

- [ ] `packages/runtime/src/sandbox/seccomp-filter.ts` (~300 LOC)
  - Generate seccomp-bpf filters
  - Block syscalls by category
  - Tool-specific filters

- [ ] `packages/runtime/src/sandbox/namespace-manager.ts` (~400 LOC)
  - Linux namespace isolation
  - PID/network/mount/IPC namespaces
  - Fallback for unprivileged

#### Tests to Create

- [ ] `packages/runtime/test/sandbox/cgroup-manager.test.ts` (~300 LOC)
- [ ] `packages/runtime/test/sandbox/seccomp-filter.test.ts` (~250 LOC)
- [ ] `packages/runtime/test/sandbox/namespace-manager.test.ts` (~300 LOC)

---

### 3.2 Tool Isolation Levels

#### New Files to Create

- [ ] `packages/shared/src/schemas/isolation-level.ts` (~100 LOC)
  - IsolationLevel enum
  - Isolation level descriptions

- [ ] `packages/runtime/src/sandbox/isolation-strategy.ts` (~200 LOC)
  - Map danger level to isolation level
  - Apply policy overrides
  - Select sandbox implementation

#### Tests to Create

- [ ] `packages/runtime/test/sandbox/isolation-strategy.test.ts` (~200 LOC)

---

### 3.3 Network Sandboxing

#### New Files to Create

- [ ] `packages/runtime/src/sandbox/network-proxy.ts` (~350 LOC)
  - HTTP/HTTPS proxy for tools
  - Intercept requests
  - Check against allowlist
  - Audit logging

- [ ] `packages/runtime/src/sandbox/network-filter.ts` (~300 LOC)
  - DNS filtering
  - IP filtering (iptables/pf)
  - Network namespace isolation
  - Rate limiting

#### Tests to Create

- [ ] `packages/runtime/test/sandbox/network-proxy.test.ts` (~300 LOC)
- [ ] `packages/runtime/test/sandbox/network-filter.test.ts` (~250 LOC)

---

### 3.4 Filesystem Sandboxing

#### New Files to Create

- [ ] `packages/runtime/src/sandbox/filesystem-jail.ts` (~300 LOC)
  - chroot/bind mount strategies
  - Symlink escape prevention
  - TOCTOU attack prevention

- [ ] `packages/runtime/src/sandbox/mount-manager.ts` (~250 LOC)
  - Linux mount namespace management
  - Minimal filesystem tree
  - Read-only mounts

#### Tests to Create

- [ ] `packages/runtime/test/sandbox/filesystem-jail.test.ts` (~350 LOC)
  - Path traversal tests
  - Symlink escape tests
  - TOCTOU race condition tests

---

## Phase 4: Configuration and Management

### 4.1 Permission Policy Management CLI

#### New Files to Create

- [ ] `packages/cli/src/commands/policy/init.ts` (~150 LOC)
- [ ] `packages/cli/src/commands/policy/list.ts` (~100 LOC)
- [ ] `packages/cli/src/commands/policy/show.ts` (~100 LOC)
- [ ] `packages/cli/src/commands/policy/edit.ts` (~150 LOC)
- [ ] `packages/cli/src/commands/policy/validate.ts` (~100 LOC)
- [ ] `packages/cli/src/commands/policy/allow.ts` (~150 LOC)
- [ ] `packages/cli/src/commands/policy/deny.ts` (~150 LOC)
- [ ] `packages/cli/src/commands/policy/reset.ts` (~100 LOC)
- [ ] `packages/cli/src/commands/policy/export.ts` (~100 LOC)

#### Tests to Create

- [ ] `packages/cli/test/commands/policy/init.test.ts` (~150 LOC)
- [ ] `packages/cli/test/commands/policy/validate.test.ts` (~150 LOC)

---

### 4.2 Runtime Permission Prompts

#### New Files to Create

- [ ] `packages/runtime/src/security/approval-manager.ts` (~300 LOC)
  - Queue approval requests
  - Emit events
  - Wait for response
  - Cache approvals

- [ ] `packages/gateway/src/events/approval-request.ts` (~100 LOC)
  - ApprovalRequest event type
  - Serialization/deserialization

- [ ] `packages/cli/src/commands/approve.ts` (~200 LOC)
  - Manual approval command
  - Auto-approve command
  - List pending
  - Revoke cached

#### Tests to Create

- [ ] `packages/runtime/test/security/approval-manager.test.ts` (~300 LOC)

---

### 4.3 Security Dashboard and Monitoring

#### New Files to Create

- [ ] `packages/cli/src/commands/security/dashboard.ts` (~300 LOC)
  - Live dashboard UI
  - Real-time updates
  - Statistics display

- [ ] `packages/cli/src/commands/security/audit.ts` (~200 LOC)
  - Audit log viewer
  - Streaming with --follow
  - Filtering

- [ ] `packages/cli/src/commands/security/violations.ts` (~150 LOC)
  - List violations
  - Filter by severity/date

- [ ] `packages/cli/src/commands/security/stats.ts` (~200 LOC)
  - Compute statistics
  - Display charts (terminal)

---

## Phase 5: Documentation and Examples

### 5.1 Security Documentation

#### New Files to Create

- [ ] `docs/security/README.md` (~500 lines)
- [ ] `docs/security/threat-model.md` (~800 lines)
- [ ] `docs/security/permission-system.md` (~1000 lines)
- [ ] `docs/security/docker-deployment.md` (~600 lines)
- [ ] `docs/security/hardening-guide.md` (~800 lines)
- [ ] `docs/security/incident-response.md` (~600 lines)
- [ ] `docs/security/security-faq.md` (~500 lines)

---

### 5.2 Example Policies

#### New Files to Create

- [ ] `examples/policies/strict.json` (~100 lines)
- [ ] `examples/policies/moderate.json` (~100 lines)
- [ ] `examples/policies/permissive.json` (~100 lines)
- [ ] `examples/policies/filesystem-only.json` (~80 lines)
- [ ] `examples/policies/network-only.json` (~80 lines)
- [ ] `examples/policies/no-execution.json` (~80 lines)
- [ ] `examples/policies/development.json` (~100 lines)
- [ ] `examples/policies/README.md` (~300 lines)

---

### 5.3 Integration Examples

#### New Files to Create

- [ ] `examples/custom-tool-with-capabilities.ts` (~150 lines)
- [ ] `examples/plugin-with-sandbox.ts` (~200 lines)
- [ ] `examples/permission-aware-agent.ts` (~250 lines)
- [ ] `examples/docker-compose-examples/production-secure.yml` (~150 lines)
- [ ] `examples/docker-compose-examples/multi-agent-isolated.yml` (~200 lines)
- [ ] `examples/docker-compose-examples/development-with-debugger.yml` (~100 lines)
- [ ] `examples/README.md` (~400 lines)

---

## Phase 6: Testing and Validation

### 6.1 Security Test Suite

#### New Files to Create

- [ ] `packages/runtime/test/security/permission-checker.test.ts` (~500 LOC)
- [ ] `packages/runtime/test/security/policy-enforcement.test.ts` (~400 LOC)
- [ ] `packages/runtime/test/security/path-traversal.test.ts` (~400 LOC)
- [ ] `packages/runtime/test/security/command-injection.test.ts` (~400 LOC)
- [ ] `packages/runtime/test/security/sandbox-isolation.test.ts` (~500 LOC)
- [ ] `packages/runtime/test/security/network-filtering.test.ts` (~350 LOC)
- [ ] `packages/runtime/test/security/resource-limits.test.ts` (~350 LOC)

---

### 6.2 Security Audit Documentation

#### New Files to Create

- [ ] `docs/security/audit-log.md` (~400 lines)
- [ ] `docs/security/penetration-test-plan.md` (~800 lines)
- [ ] `docs/security/vulnerability-disclosure.md` (~300 lines)

---

## Summary of File Changes

### By Package

| Package | New Files | Modified Files | Test Files | LOC |
|---------|-----------|----------------|------------|-----|
| shared | 6 | 1 | 2 | 1,150 |
| runtime | 16 | 1 | 15 | 6,200 |
| tools | 11 | 1 | 3 | 2,100 |
| cli | 15 | 0 | 2 | 2,400 |
| gateway | 1 | 0 | 0 | 100 |
| Root | 6 | 0 | 0 | 350 |
| docs | 13 | 0 | 0 | 6,400 |
| examples | 13 | 0 | 0 | 2,250 |
| k8s | 9 | 0 | 0 | 1,320 |
| **Total** | **90** | **3** | **22** | **~22,270** |

### By Phase

| Phase | Files | LOC | Weeks |
|-------|-------|-----|-------|
| Phase 1: Permission System | 35 | 7,500 | 3-4 |
| Phase 2: Docker Isolation | 20 | 2,800 | 1-2 |
| Phase 3: Advanced Sandboxing | 14 | 4,100 | 2-3 |
| Phase 4: Management Tools | 15 | 2,500 | 1-2 |
| Phase 5: Documentation | 26 | 4,770 | 1-2 |
| Phase 6: Testing | 10 | 3,700 | 1-2 |
| **Total** | **120** | **25,370** | **9-15** |

---

## Implementation Order

### Critical Path (Must be sequential)

1. Phase 1.1: Capability schemas (foundation for everything)
2. Phase 1.2: Permission checker (enforces policies)
3. Phase 1.3: Tool registry (tools declare capabilities)
4. Phase 1.4: Enforcement engine (runtime integration)
5. Phase 6.1: Security tests (validate implementation)

### Can Be Parallel

- Phase 2: Docker work (independent of runtime)
- Phase 4: CLI commands (can develop against stubs)
- Phase 5: Documentation (can write alongside implementation)

### Optional/Future

- Phase 3.3: Network proxy (nice-to-have, can use simple blocking)
- Phase 3.4: Filesystem jail (chroot requires root, can use path validation only)
- Phase 2.3: Kubernetes (most users will use Docker Compose)

---

## Getting Started

### Step 1: Set Up Development Environment

```bash
# Clone repo (already done)
cd /home/runner/work/HomeAgent/HomeAgent

# Install dependencies
pnpm install

# Create security branch
git checkout -b feature/security-implementation

# Create directory structure
mkdir -p packages/shared/src/schemas
mkdir -p packages/shared/src/types
mkdir -p packages/runtime/src/security
mkdir -p packages/runtime/src/execution
mkdir -p packages/runtime/src/sandbox
mkdir -p packages/tools/src/registry
mkdir -p packages/tools/src/base
mkdir -p packages/tools/src/builtin/{filesystem,execution,network,browser}
mkdir -p packages/cli/src/commands/{policy,security,approve}
mkdir -p docs/security
mkdir -p examples/policies
mkdir -p k8s
mkdir -p docker
```

### Step 2: Start with Schemas

Begin by implementing the capability and policy schemas in `packages/shared`. These are the foundation for all other security features.

```bash
# Create first file
touch packages/shared/src/capabilities.ts

# Edit and implement Capability enum
# Then create tool-manifest.ts
# Then create permission-policy.ts
```

### Step 3: Implement Permission Checker

Once schemas are in place, implement the permission checker in `packages/runtime`.

### Step 4: Create Example Tools

Implement a few builtin tools with capability declarations to test the system end-to-end.

### Step 5: Add Docker Support

Create Dockerfile and docker-compose.yml to enable containerized testing.

### Step 6: Write Tests

Create comprehensive tests for all security features.

---

## Validation Checklist

Before considering the implementation complete, verify:

- [ ] All tools declare required capabilities in manifests
- [ ] Permission checker blocks unauthorized tool execution
- [ ] Policies can be loaded from disk and cached
- [ ] Policy hot-reload works correctly
- [ ] Sandbox spawns processes with resource limits
- [ ] Path traversal attempts are blocked
- [ ] Command injection attempts are blocked
- [ ] Network filtering blocks unauthorized hosts
- [ ] Audit log records all security events
- [ ] Docker image builds and runs
- [ ] Docker security scan passes
- [ ] All security tests pass
- [ ] Documentation is complete
- [ ] Example policies work
- [ ] CLI commands work

---

## Next Steps

1. **Review this plan** with team/stakeholders
2. **Create GitHub issues** for each phase (can use existing issue templates)
3. **Assign tasks** to developers
4. **Set up project board** to track progress
5. **Begin implementation** with Phase 1.1

For questions or clarifications, refer to the detailed implementation plan in `security-implementation-plan.md`.
