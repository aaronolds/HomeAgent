# Persistence: SQLite Operational Store

## Overview
Implement the SQLite database for operational indexes and state management. While JSONL is the authoritative transcript store, SQLite serves as the fast query layer for devices, approvals, idempotency keys, agent metadata, and session indexes.

## Scope

**Included:**
- SQLite database at `~/.homeagent/homeagent.db`
- WAL mode enabled for concurrent read performance
- File permissions hardened to `0600`
- Schema: devices table (id, role, sharedSecret, approved, pairedAt)
- Schema: idempotency_keys table (key, method, deviceId, result, createdAt, expiresAt)
- Schema: agents table (id, name, workspacePath, createdAt, config)
- Schema: sessions index (sessionId, agentId, createdAt, lastActiveAt, senderId, channelId)
- Schema: nonces table (nonce, deviceId, createdAt, expiresAt)
- Migration system for schema evolution
- Database initialization and auto-migration on startup
- Transaction helpers for side-effecting operations

**Excluded:**
- Audit log (see #013 — separate JSONL file)
- Secrets encryption (see #012)
- JSONL transcript data (see #010)

## Technical Requirements

### Database Setup
```typescript
import Database from 'better-sqlite3';

function initDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
}
```

### Schema
```sql
-- Devices
CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK(role IN ('client', 'node', 'admin')),
  shared_secret_hash TEXT NOT NULL,
  approved INTEGER NOT NULL DEFAULT 0,
  paired_at INTEGER NOT NULL,
  last_seen_at INTEGER,
  metadata TEXT  -- JSON
);

-- Agents
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  workspace_path TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  config TEXT  -- JSON
);

-- Sessions index
CREATE TABLE sessions (
  session_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  sender_id TEXT,
  channel_id TEXT,
  created_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL
);

CREATE INDEX idx_sessions_agent ON sessions(agent_id);
CREATE INDEX idx_sessions_sender ON sessions(sender_id);

-- Nonces (replay protection)
CREATE TABLE nonces (
  nonce TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX idx_nonces_expires ON nonces(expires_at);

-- Idempotency keys
CREATE TABLE idempotency_keys (
  key TEXT PRIMARY KEY,
  method TEXT NOT NULL,
  device_id TEXT NOT NULL,
  result TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);
```

### Migration System
```typescript
interface Migration {
  version: number;
  name: string;
  up: string; // SQL
}

function runMigrations(db: Database.Database): void {
  // Create migrations table if not exists
  // Run pending migrations in order
  // Track applied migrations
}
```

### Data Access Layer
```typescript
class DeviceStore {
  constructor(private db: Database.Database) {}
  
  findById(deviceId: string): Device | undefined;
  create(device: NewDevice): void;
  approve(deviceId: string): void;
  revoke(deviceId: string): void;
  updateLastSeen(deviceId: string): void;
}

class AgentStore {
  constructor(private db: Database.Database) {}
  
  findById(agentId: string): Agent | undefined;
  create(agent: NewAgent): void;
  list(): Agent[];
}
```

## Implementation Plan

1. Add `better-sqlite3` as a dependency in `packages/gateway`
2. Create `packages/gateway/src/persistence/database.ts` — init, WAL mode, file permissions
3. Create `packages/gateway/src/persistence/migrations/` — migration files
4. Create migration runner
5. Create initial migration with all v1 tables
6. Create `packages/gateway/src/persistence/stores/device-store.ts`
7. Create `packages/gateway/src/persistence/stores/agent-store.ts`
8. Create `packages/gateway/src/persistence/stores/session-store.ts`
9. Create `packages/gateway/src/persistence/stores/nonce-store.ts`
10. Create `packages/gateway/src/persistence/stores/idempotency-store.ts`
11. Add periodic cleanup for expired nonces and idempotency keys
12. Write tests:
    - Database initializes with correct schema
    - Migrations run in order and are idempotent
    - Device CRUD operations
    - Agent CRUD operations
    - Nonce insert + expiry check
    - Idempotency key insert + lookup + expiry
    - File permissions are `0600`
    - WAL mode is enabled
    - Transactions roll back on error

## Acceptance Criteria
- [ ] SQLite database created at `~/.homeagent/homeagent.db`
- [ ] WAL mode enabled for concurrent reads
- [ ] File permissions set to `0600`
- [ ] All v1 tables created via migration system
- [ ] Migration system tracks applied versions and runs pending ones
- [ ] Device store supports CRUD + approve/revoke
- [ ] Agent store supports CRUD + listing
- [ ] Session index supports create + lookup by agent/sender
- [ ] Nonce store supports insert + lookup + expiry
- [ ] Idempotency store supports insert + lookup + expiry
- [ ] Periodic cleanup removes expired records
- [ ] Transactions roll back cleanly on failure
- [ ] All tests pass

## Priority
**High** — operational state storage for devices, agents, and idempotency.

**Scoring:**
- User Impact: 5 (required for auth, agents, sessions)
- Strategic Alignment: 5 (core persistence layer)
- Implementation Feasibility: 4 (better-sqlite3 is excellent)
- Resource Requirements: 3 (multiple stores + migrations)
- Risk Level: 1 (SQLite is very stable)
- **Score: 8.3**

## Dependencies
- **Blocks:** #006 (nonce store), #008 (idempotency store), #012, #014, #018
- **Blocked by:** #001, #004

## Implementation Size
- **Estimated effort:** Medium–Large (3-4 days)
- **Labels:** `enhancement`, `high-priority`, `phase-4`, `persistence`, `database`
