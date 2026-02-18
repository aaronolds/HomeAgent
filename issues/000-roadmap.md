# HomeAgent v1 Implementation Roadmap

## Overview
Tracking issue for the complete HomeAgent v1 implementation. This issue maps out all work streams, their dependencies, and suggested implementation order.

## Scope
This is a **meta-issue** — it tracks progress across all feature issues. No code changes are made directly in this issue.

## Phase Map

### Phase 1: Scaffold & Tooling
- [ ] #001 — Initialize Monorepo & Root Tooling Configuration
- [ ] #002 — Shared Package: Protocol Types & Zod Schemas
- [ ] #003 — Gateway Package: Fastify + WebSocket Server Foundation
- [ ] #004 — Remaining Package Stubs & Cross-Package Import Wiring

### Phase 2: Protocol & Schemas
- [ ] #005 — Complete RPC Method Schemas & JSON Schema Generation

### Phase 3: Gateway Core
- [ ] #006 — Gateway: Device Authentication, TLS & Pairing
- [ ] #007 — Gateway: Connection Manager & RBAC Enforcement
- [ ] #008 — Gateway: RPC Router & Idempotency Middleware
- [ ] #009 — Gateway: Event Bus, Heartbeat, Rate Limiting & Security Hardening

### Phase 4: Persistence Layer
- [ ] #010 — Persistence: JSONL Transcript Writer
- [ ] #011 — Persistence: SQLite Operational Store
- [ ] #012 — Persistence: Secrets Storage & Encryption
- [ ] #013 — Persistence: Append-Only Audit Log

### Phase 5: Agent Runtime
- [ ] #014 — Agent Runtime: Session Management & Bootstrap File Injection
- [ ] #015 — Agent Runtime: Context Assembly & Rolling Summary Compaction
- [ ] #016 — Agent Runtime: Model Streaming Adapter & Tool Execution
- [ ] #017 — Agent Runtime: Agentic Loop Hook System

### Phase 6: Multi-Agent
- [ ] #018 — Multi-Agent Support: Registry, Workspaces & Binding System

### Phase 7: Tools, Skills & Plugins
- [ ] #019 — Core Tools: File I/O, Command Execution & Web Browsing
- [ ] #020 — Plugin SDK & Trust Model
- [ ] #021 — Skills Package: Prompt Bundles & Tool Definitions

### Phase 8: Provider & Node
- [ ] #022 — Telegram Messaging Provider
- [ ] #023 — Node Host: Remote Execution & Browser Proxy

### Phase 9: CLI & Operations
- [ ] #024 — CLI: Onboarding Wizard & Core Commands
- [ ] #025 — CLI: Incident Response & Diagnostics

## Dependency Graph (Critical Path)

```
#001 → #002 → #003 → #005
                 ↓
         #004 (parallel)
                 ↓
   ┌─────────────┼─────────────┐
   ↓             ↓             ↓
 #006          #008          #009
   ↓             ↓
 #007          #010 → #011 → #012 → #013
                 ↓
         #014 → #015 → #016 → #017
                 ↓
               #018
                 ↓
   ┌─────────────┼─────────────┐
   ↓             ↓             ↓
 #019          #020          #021
   ↓             ↓
 #022 ←────── #023
                 ↓
         #024 → #025
```

## Suggested Implementation Order

**Sprint 1 (Foundation):** #001, #002, #003, #004
**Sprint 2 (Protocol + Gateway):** #005, #006, #007, #008, #009
**Sprint 3 (Persistence):** #010, #011, #012, #013
**Sprint 4 (Runtime Core):** #014, #015, #016, #017
**Sprint 5 (Multi-Agent + Tools):** #018, #019, #020, #021
**Sprint 6 (Integration):** #022, #023, #024, #025

## Labels
`tracking`, `roadmap`, `v1`

## Priority
**Critical** — this is the top-level tracking issue for the entire v1 release.
