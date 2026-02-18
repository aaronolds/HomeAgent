# Node Host: Remote Execution & Browser Proxy

## Overview
Implement the headless node host that connects to the gateway with `role: node`, advertises capabilities (command execution, browser proxy, canvas, camera, location), and executes commands and browsing tasks on remote machines with explicit approval controls.

## Scope

**Included:**
- Node host program: connects to gateway as `role: node` with HMAC auth
- Capability advertisement: declare available capabilities on connect
- Remote command execution: receive `node.exec.request`, validate against exec-approval file, execute, return results
- **Scoped exec-approval system:**
  - JSON allowlist specifying permitted command patterns, argument constraints, and working directories
  - Deny patterns take precedence over allow patterns
  - Commands not matching any allow pattern are rejected
- Browser proxy: expose Playwright browser for remote browsing tasks
- Shell injection prevention: `execFile` with array args, no shell
- All exec requests and outcomes logged to audit trail
- Reconnection logic with exponential backoff

**Excluded:**
- Canvas, camera, location capabilities (future)
- Node discovery/auto-pairing (future)
- Approval UI (admin approves via CLI — see #024)

## Technical Requirements

### Exec-Approval File
```typescript
// ~/.homeagent/nodes/<nodeId>/exec-approval.json
export const ExecApprovalConfig = z.object({
  allow: z.array(z.object({
    command: z.string(),
    args: z.array(z.string()).optional(),  // glob patterns for allowed args
    cwd: z.string().optional(),            // allowed working directory
  })),
  deny: z.array(z.object({
    command: z.string(),
    args: z.array(z.string()).optional(),
  })).default([]),
});

// Example:
// {
//   "allow": [
//     { "command": "git", "args": ["status", "log", "diff"] },
//     { "command": "npm", "args": ["run *"] }
//   ],
//   "deny": [
//     { "command": "rm" },
//     { "command": "sudo" }
//   ]
// }
```

### Node Host
```typescript
class NodeHost {
  private ws: WebSocket;
  private approvalConfig: ExecApprovalConfig;

  async connect(gatewayUrl: string, auth: NodeAuth): Promise<void> {
    // WebSocket connect with role: node
    // Send capabilities list
    // Start heartbeat
  }

  async handleExecRequest(request: ExecRequest): Promise<ExecResult> {
    // 1. Validate against exec-approval config
    // 2. Check deny patterns first (deny wins)
    // 3. Check allow patterns
    // 4. If no match, reject
    // 5. Execute via execFile (no shell)
    // 6. Log to audit trail
    // 7. Return result
  }

  async handleBrowseRequest(request: BrowseRequest): Promise<BrowseResult> {
    // Launch Playwright browser
    // Execute browsing task
    // Return content/screenshot
  }
}
```

### Command Validation
```typescript
function validateCommand(
  command: string,
  args: string[],
  cwd: string | undefined,
  config: ExecApprovalConfig,
): { allowed: boolean; reason: string } {
  // Check deny patterns first
  for (const deny of config.deny) {
    if (matchesPattern(command, args, deny)) {
      return { allowed: false, reason: `Denied by pattern: ${deny.command}` };
    }
  }
  
  // Check allow patterns
  for (const allow of config.allow) {
    if (matchesPattern(command, args, allow)) {
      if (allow.cwd && cwd && !cwd.startsWith(allow.cwd)) {
        return { allowed: false, reason: `cwd not allowed: ${cwd}` };
      }
      return { allowed: true, reason: `Allowed by pattern: ${allow.command}` };
    }
  }
  
  return { allowed: false, reason: 'No matching allow pattern' };
}
```

### Capability Advertisement
```typescript
interface NodeCapabilities {
  exec: boolean;
  browser: boolean;
  canvas: boolean;
  camera: boolean;
  location: boolean;
  os: string;
  arch: string;
  hostname: string;
}
```

## Implementation Plan

1. Create `packages/node/src/host.ts` — main node host class
2. Create `packages/node/src/auth.ts` — HMAC auth for gateway connection
3. Create `packages/node/src/exec/approval.ts` — exec-approval config loader and validator
4. Create `packages/node/src/exec/runner.ts` — command execution with `execFile`
5. Create `packages/node/src/browser/proxy.ts` — Playwright browser proxy
6. Create `packages/node/src/reconnect.ts` — exponential backoff reconnection
7. Create `packages/node/src/capabilities.ts` — capability detection and advertisement
8. Add `node.exec.request` and `node.exec.approve` handlers on the gateway side
9. Implement the approval flow: request → admin approval → execution
10. Wire audit logging for all exec events
11. Write tests:
    - Node connects to gateway with role: node
    - Capabilities are advertised
    - Allowed command executes successfully
    - Denied command is rejected
    - Command not in allowlist is rejected
    - Deny pattern overrides matching allow pattern
    - Shell injection via args is blocked (execFile, no shell)
    - Browser proxy serves browsing tasks
    - Reconnection works with backoff
    - All exec events logged to audit trail

## Acceptance Criteria
- [ ] Node connects to gateway with `role: node` and HMAC auth
- [ ] Capabilities are advertised on connect
- [ ] Exec-approval file validates command patterns
- [ ] Deny patterns take precedence over allow patterns
- [ ] Commands not in allowlist are rejected
- [ ] Approved commands execute via `execFile` (no shell)
- [ ] Command args are passed as arrays (no interpolation)
- [ ] Browser proxy launches Playwright for browsing tasks
- [ ] Reconnection handles disconnection with exponential backoff
- [ ] All exec requests and outcomes are logged to audit trail
- [ ] Gateway-side `node.exec.request` and `node.exec.approve` handlers work
- [ ] All tests pass

## Priority
**Medium** — enables remote execution but not required for core messaging.

**Scoring:**
- User Impact: 3 (power users running distributed setups)
- Strategic Alignment: 4 (in the architecture)
- Implementation Feasibility: 3 (exec approval is nuanced)
- Resource Requirements: 4 (node host + gateway handlers)
- Risk Level: 3 (security-critical: remote exec)
- **Score: 1.0**

## Dependencies
- **Blocks:** Full end-to-end remote execution
- **Blocked by:** #006, #007, #008, #013, #020

## Implementation Size
- **Estimated effort:** Large (4-5 days)
- **Labels:** `enhancement`, `medium-priority`, `phase-8`, `node`, `security`
