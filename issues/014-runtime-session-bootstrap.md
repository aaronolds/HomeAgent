# Agent Runtime: Session Management & Bootstrap File Injection

## Overview
Implement the session lock manager and bootstrap file injection system for the agent runtime. This establishes how sessions are created, resolved, locked for serial execution, and initialized with the agent's identity and configuration files on the first turn.

## Scope

**Included:**
- Session lock manager: serialize all requests per `agentId+sessionId` key
- Session resolution: resolve or create a session from inbound parameters (agentId, senderId, channelId)
- DM session isolation: per-sender isolation by default; shared session mode opt-in
- Bootstrap file injection on first turn: load `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md` from agent workspace
- Workspace file loading on every turn: reload dynamic workspace files into prompt
- Run ID lifecycle: each `agent.run` gets a unique `runId` for tracking, cancellation, and event correlation
- Agent cancellation via `agent.cancel` with `runId`

**Excluded:**
- Context assembly and compaction (see #015)
- Model inference and streaming (see #016)
- Hook system (see #017)

## Technical Requirements

### Session Lock Manager
```typescript
class SessionLockManager {
  private locks = new Map<string, Promise<void>>();

  async acquire(sessionKey: string): Promise<() => void> {
    // Queue behind any existing lock for this key
    // Return a release function
    const key = sessionKey;
    const existing = this.locks.get(key) ?? Promise.resolve();
    
    let release: () => void;
    const next = new Promise<void>((resolve) => { release = resolve; });
    this.locks.set(key, next);
    
    await existing;
    return release!;
  }
}
```

### Session Resolution
```typescript
interface SessionResolution {
  sessionId: string;
  agentId: string;
  isNew: boolean;
}

async function resolveSession(params: {
  agentId: string;
  senderId?: string;
  channelId?: string;
  isolationMode: 'per-sender' | 'shared';
}): Promise<SessionResolution>;
```

### Bootstrap Files
```typescript
const BOOTSTRAP_FILES = [
  'AGENTS.md',
  'SOUL.md',
  'TOOLS.md',
  'IDENTITY.md',
  'USER.md',
] as const;

async function loadBootstrapFiles(agentWorkspace: string): Promise<BootstrapContent[]> {
  // Read each file from ~/.homeagent/agents/<agentId>/
  // Skip missing files gracefully
  // Return content with filename metadata
}
```

### Run ID Lifecycle
```typescript
interface AgentRun {
  runId: string;
  agentId: string;
  sessionId: string;
  status: 'running' | 'completed' | 'cancelled' | 'error';
  startedAt: number;
  completedAt?: number;
}

class RunManager {
  private runs = new Map<string, AgentRun>();

  start(agentId: string, sessionId: string): AgentRun;
  cancel(runId: string): boolean;
  complete(runId: string, status: 'completed' | 'error'): void;
  get(runId: string): AgentRun | undefined;
}
```

## Implementation Plan

1. Create `packages/runtime/src/session/lock-manager.ts` — per-session serialization
2. Create `packages/runtime/src/session/resolver.ts` — session resolution with isolation modes
3. Create `packages/runtime/src/session/types.ts` — session types
4. Create `packages/runtime/src/bootstrap/loader.ts` — bootstrap file reader
5. Create `packages/runtime/src/bootstrap/workspace.ts` — workspace file loader (runs every turn)
6. Create `packages/runtime/src/run/manager.ts` — run ID lifecycle
7. Integrate with SQLite session store (#011) for persistent session index
8. Write tests:
   - Lock manager serializes concurrent requests to same session
   - Lock manager allows parallel requests to different sessions
   - Session resolution creates new session on first request
   - Session resolution returns existing session for same sender
   - Per-sender isolation creates separate sessions for different senders
   - Shared mode uses same session for all senders
   - Bootstrap files loaded on first turn (with missing files handled gracefully)
   - Workspace files reloaded on every turn
   - Run ID is unique and trackable
   - Cancel stops a running agent run

## Acceptance Criteria
- [ ] Requests to the same session are serialized (no concurrent agent loops)
- [ ] Different sessions run concurrently without cross-talk
- [ ] Session resolution creates or finds sessions based on agent+sender+channel
- [ ] DM sessions are per-sender isolated by default
- [ ] Shared session mode is configurable per agent
- [ ] Bootstrap files are injected on first turn only
- [ ] Missing bootstrap files are skipped gracefully
- [ ] Workspace files are reloaded on every turn
- [ ] Each `agent.run` returns a unique `runId`
- [ ] `agent.cancel` stops a running run
- [ ] All tests pass

## Priority
**Critical** — the runtime loop can't function without session management.

**Scoring:**
- User Impact: 5 (core agent functionality)
- Strategic Alignment: 5 (core architecture)
- Implementation Feasibility: 4 (require careful concurrency)
- Resource Requirements: 3 (moderate complexity)
- Risk Level: 2 (concurrency bugs possible)
- **Score: 4.2**

## Dependencies
- **Blocks:** #015, #016, #017
- **Blocked by:** #002, #004, #010, #011

## Implementation Size
- **Estimated effort:** Medium–Large (3-4 days)
- **Labels:** `enhancement`, `high-priority`, `phase-5`, `runtime`
