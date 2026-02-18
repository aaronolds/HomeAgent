# Plugin SDK & Trust Model

## Overview
Implement the plugin system that allows dynamic loading of new RPC methods, tools, CLI commands, background services, and loop hooks. Establish the trust model that distinguishes built-in (fully trusted) from third-party (sandboxed) plugins, with manifest-based permission enforcement.

## Scope

**Included:**
- Plugin SDK surface:
  - `registerTool(definition, handler)`
  - `registerRpcMethod(name, schema, handler)`
  - `registerProvider(providerModule)`
  - `registerBackgroundService(service)`
  - `registerCliCommand(name, schema, handler)`
  - `registerLoopHook(hookName, handler)`
- Plugin manifest format: `{ name, version, author, capabilities, permissions, signature?, sdkApiVersion }`
- **Trust tiers:**
  - Built-in: runs in main process, fully trusted
  - Third-party: runs in child process with `--experimental-permission`, sandboxed
- **Permission model:** plugins declare required permissions: `fs_read`, `fs_write`, `network`, `exec`, `privileged_hooks`
- Undeclared access attempts blocked and logged to audit trail
- **Egress control:** third-party plugins have outbound network disabled by default; must declare `network` with allowed hosts
- **Plugin signing:** optional verification against publisher keys; unsigned plugins require user confirmation
- Lifecycle hooks: `init`, `start`, `stop` with health-check and restart
- Plugin loader: discover and load plugins from `~/.homeagent/plugins/`
- `sdkApiVersion` field for forward/backward compat

**Excluded:**
- Specific plugin implementations
- Plugin marketplace/registry (future)

## Technical Requirements

### Plugin Manifest
```typescript
export const PluginManifest = z.object({
  name: z.string(),
  version: z.string(),
  author: z.string().optional(),
  description: z.string().optional(),
  sdkApiVersion: z.literal(1),
  capabilities: z.array(z.enum(['tool', 'rpc', 'provider', 'service', 'cli', 'hook'])),
  permissions: z.array(z.enum(['fs_read', 'fs_write', 'network', 'exec', 'privileged_hooks'])).default([]),
  allowedHosts: z.array(z.string()).optional(),  // for network permission
  signature: z.string().optional(),
  entryPoint: z.string(),  // relative path to main module
});
```

### Plugin SDK Interface
```typescript
interface PluginSDK {
  registerTool(definition: ToolDefinition, handler: ToolHandler): void;
  registerRpcMethod(name: string, schema: ZodSchema, handler: RpcHandler): void;
  registerProvider(module: ProviderModule): void;
  registerBackgroundService(service: BackgroundService): void;
  registerCliCommand(name: string, schema: ZodSchema, handler: CliHandler): void;
  registerLoopHook(hookName: string, handler: HookHandler): void;
}

interface BackgroundService {
  name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  healthCheck(): Promise<boolean>;
}
```

### Plugin Loader
```typescript
class PluginLoader {
  async discover(pluginDir: string): Promise<PluginManifest[]>;
  async load(manifest: PluginManifest): Promise<void>;
  async unload(pluginName: string): Promise<void>;
  
  // Trust enforcement
  private async loadBuiltIn(manifest: PluginManifest): Promise<void>;
  private async loadThirdParty(manifest: PluginManifest): Promise<void>;
}
```

### Third-Party Sandboxing
```typescript
import { fork } from 'node:child_process';

function forkSandboxed(entryPoint: string, permissions: string[]): ChildProcess {
  const args = ['--experimental-permission'];
  
  if (!permissions.includes('fs_read')) {
    args.push('--allow-fs-read=none');
  }
  if (!permissions.includes('network')) {
    args.push('--allow-net=none');
  }
  
  return fork(entryPoint, [], {
    execArgv: args,
    env: filterPluginEnv(process.env),
  });
}
```

## Implementation Plan

1. Create `packages/plugins/src/manifest.ts` — manifest Zod schema and validation
2. Create `packages/plugins/src/sdk.ts` — PluginSDK class with registration methods
3. Create `packages/plugins/src/loader.ts` — plugin discovery and loading
4. Create `packages/plugins/src/sandbox.ts` — child process sandboxing for third-party plugins
5. Create `packages/plugins/src/permissions.ts` — runtime permission enforcement
6. Create `packages/plugins/src/signing.ts` — optional signature verification
7. Create `packages/plugins/src/lifecycle.ts` — init/start/stop lifecycle with health-check
8. Integrate with hook manager (#017) for `registerLoopHook`
9. Integrate with tool executor (#016) for `registerTool`
10. Integrate with RPC router (#008) for `registerRpcMethod`
11. Add audit logging for plugin lifecycle events
12. Write tests:
    - Plugin manifest validates correctly
    - Built-in plugin loads in main process
    - Third-party plugin forks with restricted permissions
    - Undeclared permission access is blocked
    - `privileged_hooks` required for privileged hook registration
    - Unsigned plugin requires confirmation
    - Plugin lifecycle (init, start, stop) works
    - Health check restarts failed service
    - Plugin disable emergency kill switch works

## Acceptance Criteria
- [ ] All six SDK registration methods work
- [ ] Plugin manifest validates required fields
- [ ] Built-in plugins load in the main process
- [ ] Third-party plugins fork into sandboxed child processes
- [ ] `--experimental-permission` restricts fs/net/exec access
- [ ] Undeclared access attempts are blocked and logged
- [ ] `privileged_hooks` permission required for `onContextAssembled`/`onModelResponse`
- [ ] Plugin signing verification works for signed plugins
- [ ] Unsigned plugins prompt for user confirmation
- [ ] Lifecycle hooks (init/start/stop) execute correctly
- [ ] Health check detects failed services and restarts them
- [ ] `plugin.disable` kills and unloads a plugin
- [ ] `sdkApiVersion` is checked for compatibility
- [ ] All tests pass

## Priority
**Medium-High** — extensibility is a core architecture goal.

**Scoring:**
- User Impact: 4 (extensibility for power users)
- Strategic Alignment: 5 (plugin priority is high in requirements)
- Implementation Feasibility: 3 (sandboxing is complex)
- Resource Requirements: 4 (significant scope)
- Risk Level: 3 (security implications)
- **Score: 1.7**

## Dependencies
- **Blocks:** #021, #022 (providers are plugins), #023
- **Blocked by:** #008, #016, #017

## Implementation Size
- **Estimated effort:** Large (4-5 days)
- **Labels:** `enhancement`, `high-priority`, `phase-7`, `plugins`, `sdk`, `security`
