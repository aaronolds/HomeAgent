# Multi-Agent Support: Registry, Workspaces & Binding System

## Overview
Implement multi-agent support so HomeAgent can host multiple isolated agents simultaneously. Each agent has its own workspace, configuration, skill set, and session space. A binding system routes inbound messages from providers to the correct agent based on channel/sender rules.

## Scope

**Included:**
- Agent registry backed by SQLite: CRUD for agents with isolated configurations
- Per-agent workspace directories at `~/.homeagent/agents/<agentId>/`
- Agent workspace initialization: create standard directory structure and default files
- Binding system: map provider channels/senders to specific agents
- Binding resolution: given an inbound message (provider, channel, sender), determine the target agent
- Default agent: fallback when no binding matches
- Agent isolation: agents cannot access each other's workspaces or sessions
- Agent-scoped configuration: model selection, temperature, system prompt overrides, enabled tools

**Excluded:**
- Provider implementation (see #022)
- Agent runtime loop (see #014-#017 — already built)
- CLI for agent management (see #024)

## Technical Requirements

### Agent Registry
```typescript
interface Agent {
  id: string;
  name: string;
  workspacePath: string;
  config: AgentConfig;
  createdAt: number;
  isDefault: boolean;
}

interface AgentConfig {
  model: string;              // e.g., 'gpt-4o' or 'claude-sonnet-4-20250514'
  provider: 'openai' | 'anthropic';
  temperature?: number;
  maxTokens?: number;
  systemPromptOverride?: string;
  enabledTools?: string[];
  isolationMode: 'per-sender' | 'shared';
}

class AgentRegistry {
  constructor(private store: AgentStore) {}

  create(params: CreateAgentParams): Agent;
  update(agentId: string, updates: Partial<AgentConfig>): Agent;
  delete(agentId: string): void;
  get(agentId: string): Agent | undefined;
  getDefault(): Agent;
  list(): Agent[];
  initWorkspace(agentId: string): void;
}
```

### Workspace Structure
```
~/.homeagent/agents/<agentId>/
├── AGENTS.md           # Agent directory (optional)
├── SOUL.md             # Agent personality
├── TOOLS.md            # Available tools documentation
├── IDENTITY.md         # Agent identity/name
├── USER.md             # User information
├── sessions/           # JSONL transcripts
│   ├── <sessionId>.jsonl
│   └── <sessionId>.compacted.jsonl
└── config.json         # Agent-specific config overrides
```

### Binding System
```typescript
interface Binding {
  id: string;
  agentId: string;
  provider: string;        // e.g., 'telegram', 'slack'
  channelId?: string;      // specific channel/chat
  senderId?: string;       // specific sender
  priority: number;        // higher = checked first
  createdAt: number;
}

class BindingRouter {
  constructor(private bindings: Binding[]) {}

  resolve(params: {
    provider: string;
    channelId?: string;
    senderId?: string;
  }): Agent | undefined {
    // Check bindings in priority order
    // Most specific match wins (channel+sender > channel > sender > default)
  }
}
```

### SQLite Tables
```sql
CREATE TABLE bindings (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  provider TEXT NOT NULL,
  channel_id TEXT,
  sender_id TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE(provider, channel_id, sender_id)
);

CREATE INDEX idx_bindings_provider ON bindings(provider);
```

## Implementation Plan

1. Create `packages/runtime/src/agents/registry.ts` — agent CRUD operations
2. Create `packages/runtime/src/agents/workspace.ts` — workspace init and file management
3. Create `packages/runtime/src/agents/types.ts` — agent types
4. Create `packages/runtime/src/bindings/router.ts` — binding resolution
5. Create `packages/runtime/src/bindings/types.ts` — binding types
6. Add bindings table to SQLite migrations (#011)
7. Implement workspace isolation: verify path prefix on all file operations
8. Implement default agent fallback
9. Write tests:
   - Create agent initializes workspace directory
   - Agent configs are isolated
   - Binding resolution: exact match (channel+sender) wins over wildcard
   - Default agent used when no binding matches
   - Agent deletion cleans up bindings
   - Agent A cannot access agent B's workspace
   - Workspace file operations respect path boundaries

## Acceptance Criteria
- [ ] Agents can be created, updated, deleted, and listed
- [ ] Each agent has an isolated workspace at `~/.homeagent/agents/<agentId>/`
- [ ] Workspace initialization creates standard directory structure
- [ ] Bindings route inbound messages to the correct agent
- [ ] Most-specific binding wins (channel+sender > channel > sender)
- [ ] Default agent handles unbound messages
- [ ] Agents cannot access each other's workspaces or sessions
- [ ] Agent configuration includes model, temperature, tools, isolation mode
- [ ] Binding CRUD operations work via SQLite
- [ ] All tests pass

## Priority
**Medium** — enables multi-persona and multi-user scenarios.

**Scoring:**
- User Impact: 4 (multi-persona is a key differentiator)
- Strategic Alignment: 5 (in the architecture spec)
- Implementation Feasibility: 4 (well-defined)
- Resource Requirements: 3 (moderate)
- Risk Level: 2 (isolation must be correct)
- **Score: 3.3**

## Dependencies
- **Blocks:** #019, #022, #024
- **Blocked by:** #011, #014

## Implementation Size
- **Estimated effort:** Medium–Large (3-4 days)
- **Labels:** `enhancement`, `medium-priority`, `phase-6`, `runtime`, `multi-agent`
