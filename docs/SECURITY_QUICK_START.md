# Security Implementation Quick Start Guide

This guide helps developers quickly get started implementing the HomeAgent security features.

## Prerequisites

✓ You've read `SECURITY_PLAN_SUMMARY.md`  
✓ Repository is cloned and dependencies installed  
✓ You understand the three security layers  

## Overview

We'll build security features in 6 phases over ~11 weeks. You can start with any phase, but **Phase 1 is recommended** as it's the foundation for everything else.

---

## Phase 1: Permission System (CRITICAL PATH)

**Goal**: Implement capability-based permission system  
**Time**: 3-4 weeks  
**Priority**: P0 (must have)

### Week 1: Foundation Schemas

#### Day 1-2: Capability Types

**Create**: `packages/shared/src/capabilities.ts`

```typescript
export enum Capability {
  // Filesystem
  FILESYSTEM_READ = "FILESYSTEM_READ",
  FILESYSTEM_WRITE = "FILESYSTEM_WRITE",
  FILESYSTEM_READ_SYSTEM = "FILESYSTEM_READ_SYSTEM",
  FILESYSTEM_WRITE_SYSTEM = "FILESYSTEM_WRITE_SYSTEM",
  
  // Network
  NETWORK_OUTBOUND = "NETWORK_OUTBOUND",
  NETWORK_INBOUND = "NETWORK_INBOUND",
  
  // Process
  PROCESS_SPAWN = "PROCESS_SPAWN",
  PROCESS_EXEC = "PROCESS_EXEC",
  
  // System
  ENVIRONMENT_READ = "ENVIRONMENT_READ",
  ENVIRONMENT_WRITE = "ENVIRONMENT_WRITE",
  
  // Privileged
  PRIVILEGED_CONTEXT = "PRIVILEGED_CONTEXT",
}

export const CapabilityMetadata: Record<Capability, {
  name: string;
  description: string;
  dangerLevel: "safe" | "low" | "medium" | "high" | "critical";
  category: string;
}> = {
  [Capability.FILESYSTEM_READ]: {
    name: "Filesystem Read",
    description: "Read files within agent workspace",
    dangerLevel: "low",
    category: "filesystem"
  },
  // ... etc
};
```

**Test**: Create `packages/shared/test/capabilities.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { Capability, CapabilityMetadata } from '../src/capabilities';

describe('Capability', () => {
  it('should have metadata for all capabilities', () => {
    const capabilities = Object.values(Capability);
    for (const cap of capabilities) {
      expect(CapabilityMetadata[cap]).toBeDefined();
      expect(CapabilityMetadata[cap].name).toBeTruthy();
    }
  });
});
```

**Run test**: `pnpm test packages/shared`

#### Day 3-4: Tool Manifest Schema

**Create**: `packages/shared/src/schemas/tool-manifest.ts`

```typescript
import { z } from 'zod';
import { Capability } from '../capabilities';

export const ToolManifestSchema = z.object({
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string(),
  category: z.enum(['filesystem', 'execution', 'network', 'browser', 'system', 'plugin']),
  requiredCapabilities: z.array(z.nativeEnum(Capability)),
  optionalCapabilities: z.array(z.nativeEnum(Capability)).optional(),
  dangerLevel: z.enum(['safe', 'low', 'medium', 'high', 'critical']),
  networkHosts: z.array(z.string()).optional(),
  filesystemPaths: z.array(z.string()).optional(),
  auditLogLevel: z.enum(['none', 'minimal', 'standard', 'verbose']),
});

export type ToolManifest = z.infer<typeof ToolManifestSchema>;

export function validateToolManifest(manifest: unknown): ToolManifest {
  return ToolManifestSchema.parse(manifest);
}
```

**Test**: `packages/shared/test/schemas/tool-manifest.test.ts`

#### Day 5: Permission Policy Schema

**Create**: `packages/shared/src/schemas/permission-policy.ts`

```typescript
import { z } from 'zod';
import { Capability } from '../capabilities';

export const PermissionPolicySchema = z.object({
  version: z.literal(1),
  agentId: z.string().optional(),
  deviceId: z.string().optional(),
  mode: z.enum(['allowlist', 'denylist', 'prompt']),
  
  capabilities: z.object({
    allowed: z.array(z.nativeEnum(Capability)),
    denied: z.array(z.nativeEnum(Capability)),
    prompt: z.array(z.nativeEnum(Capability)),
  }),
  
  tools: z.object({
    allowed: z.array(z.string()),
    denied: z.array(z.string()),
    prompt: z.array(z.string()),
  }).optional(),
  
  networkPolicy: z.object({
    mode: z.enum(['deny', 'allowlist']),
    allowedHosts: z.array(z.string()),
    deniedHosts: z.array(z.string()),
  }).optional(),
  
  filesystemPolicy: z.object({
    mode: z.enum(['workspace-only', 'allowlist']),
    allowedPaths: z.array(z.string()),
    deniedPaths: z.array(z.string()),
  }).optional(),
  
  executionPolicy: z.object({
    allowShell: z.boolean(),
    allowedCommands: z.array(z.object({
      command: z.string(),
      args: z.array(z.string()).optional(),
      cwd: z.array(z.string()).optional(),
    })),
    deniedCommands: z.array(z.string()),
    maxExecutionTime: z.number().int().positive(),
    maxConcurrent: z.number().int().positive(),
  }).optional(),
  
  resourceLimits: z.object({
    maxMemoryMB: z.number().int().positive(),
    maxCPUPercent: z.number().int().min(1).max(100),
    maxFileSize: z.number().int().positive(),
    maxNetworkBytesPerMin: z.number().int().nonnegative(),
  }).optional(),
  
  auditPolicy: z.object({
    logLevel: z.enum(['none', 'minimal', 'standard', 'verbose']),
    logSensitiveData: z.boolean(),
  }).optional(),
});

export type PermissionPolicy = z.infer<typeof PermissionPolicySchema>;

export const DEFAULT_POLICY: PermissionPolicy = {
  version: 1,
  mode: 'allowlist',
  capabilities: {
    allowed: [Capability.FILESYSTEM_READ, Capability.FILESYSTEM_WRITE],
    denied: [Capability.FILESYSTEM_READ_SYSTEM, Capability.FILESYSTEM_WRITE_SYSTEM],
    prompt: [Capability.PROCESS_EXEC, Capability.NETWORK_OUTBOUND],
  },
  filesystemPolicy: {
    mode: 'workspace-only',
    allowedPaths: [],
    deniedPaths: [],
  },
};
```

**Export**: Update `packages/shared/src/index.ts`

```typescript
export * from './capabilities';
export * from './schemas/tool-manifest';
export * from './schemas/permission-policy';
```

### Week 2: Permission Checker

#### Day 6-8: Policy Loader

**Create**: `packages/runtime/src/security/policy-loader.ts`

```typescript
import fs from 'node:fs/promises';
import path from 'node:path';
import { watch } from 'node:fs';
import { PermissionPolicy, PermissionPolicySchema, DEFAULT_POLICY } from '@homeagent/shared';

export class PolicyLoader {
  private policies = new Map<string, PermissionPolicy>();
  private watchers = new Map<string, fs.FSWatcher>();
  
  async loadPolicy(agentId: string, deviceId?: string): Promise<PermissionPolicy> {
    // Try to load policies in order: device → agent → global
    const devicePolicy = deviceId ? await this.loadPolicyFile('devices', deviceId) : null;
    const agentPolicy = await this.loadPolicyFile('agents', agentId);
    const globalPolicy = await this.loadPolicyFile('', 'default');
    
    // Merge policies (device overrides agent overrides global)
    return this.mergePolicies([globalPolicy, agentPolicy, devicePolicy].filter(Boolean));
  }
  
  private async loadPolicyFile(type: string, id: string): Promise<PermissionPolicy | null> {
    const policyPath = this.getPolicyPath(type, id);
    const cacheKey = `${type}:${id}`;
    
    try {
      const content = await fs.readFile(policyPath, 'utf-8');
      const policy = PermissionPolicySchema.parse(JSON.parse(content));
      this.policies.set(cacheKey, policy);
      
      // Set up file watcher for hot-reload
      this.watchPolicyFile(policyPath, cacheKey);
      
      return policy;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null; // File doesn't exist
      }
      throw error; // Other errors
    }
  }
  
  private getPolicyPath(type: string, id: string): string {
    const homeDir = process.env.HOMEAGENT_DATA_DIR || path.join(process.env.HOME!, '.homeagent');
    if (type === '') {
      return path.join(homeDir, 'policies', `${id}.json`);
    }
    return path.join(homeDir, type, id, 'policy.json');
  }
  
  private watchPolicyFile(filePath: string, cacheKey: string): void {
    if (this.watchers.has(cacheKey)) return;
    
    const watcher = watch(filePath, async (eventType) => {
      if (eventType === 'change') {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const policy = PermissionPolicySchema.parse(JSON.parse(content));
          this.policies.set(cacheKey, policy);
          console.log(`Policy reloaded: ${cacheKey}`);
        } catch (error) {
          console.error(`Failed to reload policy ${cacheKey}:`, error);
        }
      }
    });
    
    this.watchers.set(cacheKey, watcher);
  }
  
  private mergePolicies(policies: PermissionPolicy[]): PermissionPolicy {
    // Start with default policy
    let merged = { ...DEFAULT_POLICY };
    
    // Apply each policy in order (later policies override earlier ones)
    for (const policy of policies) {
      merged = {
        ...merged,
        ...policy,
        capabilities: {
          allowed: [...new Set([...merged.capabilities.allowed, ...policy.capabilities.allowed])],
          denied: [...new Set([...merged.capabilities.denied, ...policy.capabilities.denied])],
          prompt: [...new Set([...merged.capabilities.prompt, ...policy.capabilities.prompt])],
        },
      };
    }
    
    // Deny takes precedence: remove denied from allowed/prompt
    merged.capabilities.allowed = merged.capabilities.allowed.filter(
      cap => !merged.capabilities.denied.includes(cap)
    );
    merged.capabilities.prompt = merged.capabilities.prompt.filter(
      cap => !merged.capabilities.denied.includes(cap)
    );
    
    return merged;
  }
  
  clearCache(): void {
    this.policies.clear();
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
  }
}
```

#### Day 9-10: Permission Checker

**Create**: `packages/runtime/src/security/permission-checker.ts`

```typescript
import { Capability, PermissionPolicy } from '@homeagent/shared';
import { PolicyLoader } from './policy-loader';

export interface PermissionContext {
  agentId: string;
  sessionId: string;
  deviceId?: string;
  userId?: string;
}

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  matchedRule?: string;
  requiresPrompt: boolean;
  dangerLevel: string;
}

export class PermissionChecker {
  constructor(private policyLoader: PolicyLoader) {}
  
  async checkCapability(
    capability: Capability,
    context: PermissionContext
  ): Promise<PermissionResult> {
    const policy = await this.policyLoader.loadPolicy(context.agentId, context.deviceId);
    
    // Check denied first (deny takes precedence)
    if (policy.capabilities.denied.includes(capability)) {
      return {
        allowed: false,
        reason: `Capability ${capability} is explicitly denied by policy`,
        matchedRule: 'capabilities.denied',
        requiresPrompt: false,
        dangerLevel: 'blocked',
      };
    }
    
    // Check if requires prompt
    if (policy.capabilities.prompt.includes(capability)) {
      return {
        allowed: false,
        reason: `Capability ${capability} requires user approval`,
        matchedRule: 'capabilities.prompt',
        requiresPrompt: true,
        dangerLevel: 'requires_approval',
      };
    }
    
    // Check allowed
    if (policy.capabilities.allowed.includes(capability)) {
      return {
        allowed: true,
        matchedRule: 'capabilities.allowed',
        requiresPrompt: false,
        dangerLevel: 'allowed',
      };
    }
    
    // Default deny in allowlist mode
    if (policy.mode === 'allowlist') {
      return {
        allowed: false,
        reason: `Capability ${capability} not in allowlist`,
        matchedRule: 'default_deny',
        requiresPrompt: false,
        dangerLevel: 'blocked',
      };
    }
    
    // Default allow in denylist mode (but should require prompt)
    return {
      allowed: true,
      reason: `Capability ${capability} not explicitly denied`,
      matchedRule: 'default_allow',
      requiresPrompt: false,
      dangerLevel: 'implicit_allow',
    };
  }
  
  async checkToolExecution(
    toolName: string,
    capabilities: Capability[],
    context: PermissionContext
  ): Promise<PermissionResult> {
    const policy = await this.policyLoader.loadPolicy(context.agentId, context.deviceId);
    
    // Check tool-level deny
    if (policy.tools?.denied.includes(toolName)) {
      return {
        allowed: false,
        reason: `Tool ${toolName} is explicitly denied`,
        matchedRule: 'tools.denied',
        requiresPrompt: false,
        dangerLevel: 'blocked',
      };
    }
    
    // Check tool-level prompt
    if (policy.tools?.prompt.includes(toolName)) {
      return {
        allowed: false,
        reason: `Tool ${toolName} requires user approval`,
        matchedRule: 'tools.prompt',
        requiresPrompt: true,
        dangerLevel: 'requires_approval',
      };
    }
    
    // Check tool-level allow
    const toolAllowed = !policy.tools || 
                       policy.tools.allowed.length === 0 || 
                       policy.tools.allowed.includes(toolName);
    
    if (!toolAllowed) {
      return {
        allowed: false,
        reason: `Tool ${toolName} not in allowlist`,
        matchedRule: 'tools.allowlist',
        requiresPrompt: false,
        dangerLevel: 'blocked',
      };
    }
    
    // Check all required capabilities
    for (const capability of capabilities) {
      const capResult = await this.checkCapability(capability, context);
      if (!capResult.allowed) {
        return capResult; // Return first failing capability check
      }
    }
    
    return {
      allowed: true,
      matchedRule: 'all_checks_passed',
      requiresPrompt: false,
      dangerLevel: 'allowed',
    };
  }
}
```

**Test**: Create comprehensive tests in `packages/runtime/test/security/`

### Week 3-4: Tool Registry & Executor

Continue implementing according to the detailed plan...

---

## Quick Commands

### Initialize Project Structure

```bash
# From repository root
cd /home/runner/work/HomeAgent/HomeAgent

# Create directories
mkdir -p packages/shared/src/{schemas,types}
mkdir -p packages/shared/test/schemas
mkdir -p packages/runtime/src/{security,execution,sandbox}
mkdir -p packages/runtime/test/security
mkdir -p packages/tools/src/{registry,base,builtin/{filesystem,execution,network}}
mkdir -p packages/cli/src/commands/{policy,security}
mkdir -p docs/security
mkdir -p examples/policies

# Install dependencies (if needed)
pnpm add zod minimatch
pnpm add -D @types/node vitest
```

### Run Tests

```bash
# Test specific package
pnpm --filter @homeagent/shared test

# Test all packages
pnpm test

# Test with coverage
pnpm test --coverage
```

### Build

```bash
# Build specific package
pnpm --filter @homeagent/shared build

# Build all packages
pnpm build
```

### Lint

```bash
# Check formatting and lint
biome check .

# Fix auto-fixable issues
biome check --apply .
```

---

## Development Workflow

### 1. Start with a Feature Branch

```bash
git checkout -b feature/security-phase1-capabilities
```

### 2. Implement TDD Style

```typescript
// 1. Write test first
describe('PermissionChecker', () => {
  it('should deny capability not in allowlist', async () => {
    const policy = { /* ... */ };
    const checker = new PermissionChecker(policyLoader);
    const result = await checker.checkCapability(Capability.PROCESS_EXEC, context);
    expect(result.allowed).toBe(false);
  });
});

// 2. Run test (it should fail)
pnpm test

// 3. Implement feature
// 4. Run test again (it should pass)
// 5. Refactor if needed
```

### 3. Commit Often

```bash
git add packages/shared/src/capabilities.ts
git commit -m "feat(shared): add Capability enum and metadata"

git add packages/shared/test/capabilities.test.ts
git commit -m "test(shared): add capability tests"
```

### 4. Create PR

```bash
git push origin feature/security-phase1-capabilities
# Create PR on GitHub
```

---

## Common Patterns

### Pattern 1: Schema Definition

```typescript
// Define Zod schema
export const MySchema = z.object({
  field: z.string(),
});

// Export type
export type MyType = z.infer<typeof MySchema>;

// Export validator
export function validateMyType(data: unknown): MyType {
  return MySchema.parse(data);
}
```

### Pattern 2: Error Handling

```typescript
// Define custom error
export class SecurityError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'SecurityError';
  }
}

// Use in code
if (!result.allowed) {
  throw new SecurityError(
    result.reason!,
    'PERMISSION_DENIED',
    { capability, context }
  );
}
```

### Pattern 3: Async Loading with Cache

```typescript
export class MyLoader {
  private cache = new Map<string, MyData>();
  
  async load(id: string): Promise<MyData> {
    // Check cache first
    if (this.cache.has(id)) {
      return this.cache.get(id)!;
    }
    
    // Load from disk
    const data = await this.loadFromDisk(id);
    
    // Cache result
    this.cache.set(id, data);
    
    return data;
  }
  
  clearCache(): void {
    this.cache.clear();
  }
}
```

---

## Debugging Tips

### Enable Debug Logging

```bash
# Run with debug logging
NODE_ENV=development HOMEAGENT_LOG_LEVEL=debug pnpm dev
```

### Use Node Debugger

```typescript
// Add breakpoint
debugger;

// Or use console.log strategically
console.log('Permission check:', { capability, context, result });
```

### Test Individual Files

```bash
# Run single test file
pnpm vitest packages/shared/test/capabilities.test.ts

# Run with watch mode
pnpm vitest packages/shared/test/capabilities.test.ts --watch
```

---

## Getting Help

- **Documentation**: See `docs/security-implementation-plan.md` for full details
- **Checklist**: See `docs/security-implementation-checklist.md` for all files
- **Architecture**: See `docs/security-architecture-diagram.txt` for visual guide
- **Existing Code**: Look at other packages for patterns (e.g., `packages/shared`)
- **Issues**: Check GitHub issues for discussions
- **Tests**: Look at test files for usage examples

---

## Next Steps

Once you've completed Phase 1, move on to:

1. **Phase 2**: Docker configuration (can be done in parallel)
2. **Phase 3**: Advanced sandboxing (requires Phase 1)
3. **Phase 4**: Management tools (requires Phase 1)
4. **Phase 5**: Documentation (ongoing)
5. **Phase 6**: Security tests (validates everything)

Good luck! 🚀
