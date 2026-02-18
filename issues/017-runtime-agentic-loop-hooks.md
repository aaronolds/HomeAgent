# Agent Runtime: Agentic Loop Hook System

## Overview
Implement the named hook points in the agentic loop that allow plugins and built-in modules to inject custom logic at specific stages of request processing. This is the extensibility mechanism that powers custom behaviors, logging, prompt manipulation, and response filtering.

## Scope

**Included:**
- Hook registration via `registerLoopHook(hookName, handler)`
- Five named hook points:
  - `onIntake` — after request validation, before session resolution
  - `onContextAssembled` — after context assembly, before model inference (**privileged**)
  - `onModelResponse` — after model response, before tool execution (**privileged**)
  - `onToolResult` — after each tool execution, before continuing the loop
  - `onTurnComplete` — after persistence, before returning to caller
- Hook execution in registration order
- **Trust tiers:** `onContextAssembled` and `onModelResponse` restricted to built-in plugins or plugins with explicit `privileged_hooks` permission
- Async hook handlers with error isolation (one hook failure doesn't crash the loop)
- Hook timeout: configurable max execution time per hook (default: 5s)

**Excluded:**
- Plugin SDK full implementation (see #020)
- Specific plugin implementations

## Technical Requirements

### Hook Types
```typescript
export const HookName = z.enum([
  'onIntake',
  'onContextAssembled',
  'onModelResponse',
  'onToolResult',
  'onTurnComplete',
]);

export const PRIVILEGED_HOOKS: HookName[] = ['onContextAssembled', 'onModelResponse'];

interface HookContext {
  agentId: string;
  sessionId: string;
  runId: string;
  // Hook-specific data varies by hook point
}

type HookHandler = (context: HookContext, data: unknown) => Promise<unknown>;

interface HookRegistration {
  hookName: string;
  handler: HookHandler;
  pluginName: string;
  isBuiltIn: boolean;
  hasPrivilegedPermission: boolean;
}
```

### Hook Manager
```typescript
class HookManager {
  private hooks = new Map<string, HookRegistration[]>();

  register(registration: HookRegistration): void {
    // Check trust tier for privileged hooks
    if (PRIVILEGED_HOOKS.includes(registration.hookName)) {
      if (!registration.isBuiltIn && !registration.hasPrivilegedPermission) {
        throw new Error(`Plugin ${registration.pluginName} lacks privileged_hooks permission`);
      }
    }
    // Append in registration order
  }

  async execute(hookName: string, context: HookContext, data: unknown): Promise<unknown> {
    const handlers = this.hooks.get(hookName) ?? [];
    let result = data;
    for (const { handler, pluginName } of handlers) {
      try {
        result = await withTimeout(handler(context, result), this.timeoutMs);
      } catch (err) {
        // Log error, continue to next handler
        // Emit audit event for hook failure
      }
    }
    return result;
  }
}
```

### Integration with Agentic Loop
```typescript
// In agentic loop:
// 1. onIntake: modify/validate the incoming request
data = await hookManager.execute('onIntake', ctx, requestData);

// 2. onContextAssembled: modify the assembled context (prompt rewriting)
assembledContext = await hookManager.execute('onContextAssembled', ctx, assembledContext);

// 3. onModelResponse: filter/modify model response before tool execution
modelResponse = await hookManager.execute('onModelResponse', ctx, modelResponse);

// 4. onToolResult: transform/audit tool results
toolResult = await hookManager.execute('onToolResult', ctx, toolResult);

// 5. onTurnComplete: side effects (notifications, analytics)
await hookManager.execute('onTurnComplete', ctx, turnSummary);
```

## Implementation Plan

1. Create `packages/runtime/src/hooks/types.ts` — hook type definitions
2. Create `packages/runtime/src/hooks/manager.ts` — hook registration and execution
3. Implement trust tier enforcement for privileged hooks
4. Implement timeout wrapper for hook execution
5. Implement error isolation: catch and log per-hook errors
6. Integrate hook calls into the agentic loop at each named point
7. Add audit logging for hook registration and failures
8. Write tests:
   - Hook registered and called in order
   - Multiple hooks for same point execute sequentially
   - Privileged hook rejected for untrusted plugin
   - Privileged hook accepted for built-in plugin
   - Hook timeout triggers without crashing the loop
   - Hook error is isolated and logged
   - Data flows through hooks (pipeline pattern)
   - `onContextAssembled` can modify the prompt

## Acceptance Criteria
- [ ] All five hook points are invocable in the agentic loop
- [ ] Hooks execute in registration order
- [ ] `onContextAssembled` and `onModelResponse` are restricted to trusted plugins
- [ ] Untrusted plugin attempting to register privileged hooks is rejected with error
- [ ] Hook timeouts prevent hanging
- [ ] Hook errors are caught, logged, and do not crash the loop
- [ ] Data flows through the hook chain (pipeline pattern)
- [ ] Hook failures are recorded in the audit log
- [ ] All tests pass

## Priority
**Medium** — important for extensibility but not blocking the core loop.

**Scoring:**
- User Impact: 3 (power users and plugin devs)
- Strategic Alignment: 5 (plugin priority is high)
- Implementation Feasibility: 4 (straightforward pattern)
- Resource Requirements: 2 (moderate)
- Risk Level: 2 (security implications for privileged hooks)
- **Score: 3.75**

## Dependencies
- **Blocks:** #020 (Plugin SDK uses hooks)
- **Blocked by:** #014, #016

## Implementation Size
- **Estimated effort:** Medium (2-3 days)
- **Labels:** `enhancement`, `medium-priority`, `phase-5`, `runtime`, `plugins`
