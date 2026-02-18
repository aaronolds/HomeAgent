# CLI: Incident Response & Diagnostics

## Overview
Implement the incident response and diagnostics CLI commands that enable operators to respond to security events, manage secrets, troubleshoot issues, and monitor the system in real-time. These are the "break glass" tools for operational emergencies.

## Scope

**Included:**
- **Incident response commands:**
  - `homeagent device revoke <deviceId>` — force-unpair a device and invalidate all its sessions
  - `homeagent plugin disable <pluginName>` — emergency kill switch for a running plugin
  - `homeagent sessions kill <sessionId>` — terminate an active session immediately
  - `homeagent secrets rotate <name>` — rotate and re-encrypt a credential
- **Audit commands:**
  - `homeagent audit tail [--count N] [--follow]` — stream recent security audit events
  - `homeagent audit search --type <eventType> [--since <timestamp>] [--actor <deviceId>]`
- **Diagnostics commands:**
  - `homeagent diagnostics` — system health overview (server status, DB integrity, disk usage, active connections)
  - `homeagent diagnostics connections` — list all active WebSocket connections with details
  - `homeagent diagnostics db-check` — run SQLite integrity check
  - `homeagent diagnostics logs [--level <level>]` — view recent application logs

**Excluded:**
- Automated alerting/notification (future)
- Web-based dashboard (future)

## Technical Requirements

### Device Revocation
```typescript
// homeagent device revoke <deviceId>
async function revokeDevice(deviceId: string): Promise<void> {
  // 1. Mark device as revoked in SQLite
  // 2. Force-disconnect all active connections for this device
  // 3. Invalidate all session tokens
  // 4. Log to audit trail
  // 5. Confirm to operator
}
```

### Plugin Disable
```typescript
// homeagent plugin disable <pluginName>
async function disablePlugin(pluginName: string): Promise<void> {
  // 1. Send stop lifecycle event to plugin
  // 2. Kill child process if third-party
  // 3. Unregister all plugin handlers (tools, RPC, hooks)
  // 4. Mark as disabled in config
  // 5. Log to audit trail
}
```

### Secret Rotation
```typescript
// homeagent secrets rotate <name>
async function rotateSecret(name: string): Promise<void> {
  // 1. Prompt for new value (or auto-generate for certain types)
  // 2. Store new value via secrets manager
  // 3. Notify affected subsystems to reload (e.g., provider reconnect)
  // 4. Log rotation event to audit trail (never log the value)
}
```

### Audit Tail
```typescript
// homeagent audit tail --count 50 --follow
async function auditTail(options: { count: number; follow: boolean }): Promise<void> {
  // 1. Read last N lines from audit.jsonl
  // 2. Format and display with color coding by severity
  // 3. If --follow: watch file for new lines (like tail -f)
}
```

### Diagnostics
```typescript
// homeagent diagnostics
async function diagnostics(): Promise<void> {
  // Server uptime
  // Node.js version and memory usage
  // SQLite database size and integrity
  // Active connections count by role
  // Active sessions count
  // Disk usage for ~/.homeagent/
  // Plugin status (running/stopped/errored)
  // Provider status (connected/disconnected)
}
```

## Implementation Plan

1. Create `packages/cli/src/commands/device-revoke.ts` — device revocation
2. Create `packages/cli/src/commands/plugin-disable.ts` — plugin kill switch
3. Create `packages/cli/src/commands/sessions-kill.ts` — session termination
4. Create `packages/cli/src/commands/secrets-rotate.ts` — credential rotation
5. Create `packages/cli/src/commands/audit.ts` — audit tail and search
6. Create `packages/cli/src/commands/diagnostics.ts` — system health checks
7. Add color-coded output for audit events (chalk or similar)
8. Integrate with connection manager for `device revoke`
9. Integrate with plugin loader for `plugin disable`
10. Integrate with audit logger for `audit tail`/`audit search`
11. Integrate with secrets manager for `secrets rotate`
12. Write tests:
    - `device revoke` disconnects device and updates DB
    - `plugin disable` stops and unloads plugin
    - `sessions kill` terminates active session
    - `secrets rotate` stores new value and logs event
    - `audit tail` formats recent events correctly
    - `audit search` filters by type and time
    - `diagnostics` reports system health
    - `db-check` runs SQLite integrity check

## Acceptance Criteria
- [ ] `device revoke` force-unpairs device and disconnects all its connections
- [ ] `plugin disable` stops and unloads a running plugin
- [ ] `sessions kill` terminates an active session immediately
- [ ] `secrets rotate` rotates a credential without downtime
- [ ] `audit tail` displays recent audit events with color coding
- [ ] `audit tail --follow` streams new events in real-time
- [ ] `audit search` filters events by type, actor, and time range
- [ ] `diagnostics` shows server health, DB integrity, disk usage
- [ ] All incident response actions are logged to the audit trail
- [ ] Secret values are never displayed or logged during rotation
- [ ] All tests pass

## Priority
**Medium** — important for production operations but not blocking initial functionality.

**Scoring:**
- User Impact: 3 (operators in emergencies)
- Strategic Alignment: 4 (security and operations)
- Implementation Feasibility: 4 (CLI patterns established in #024)
- Resource Requirements: 3 (multiple commands)
- Risk Level: 2 (must correctly revoke/disable)
- **Score: 2.0**

## Dependencies
- **Blocks:** Production readiness
- **Blocked by:** #024, #007 (connection manager), #013 (audit log), #012 (secrets), #020 (plugins)

## Implementation Size
- **Estimated effort:** Medium–Large (3-4 days)
- **Labels:** `enhancement`, `medium-priority`, `phase-9`, `cli`, `security`, `operations`
