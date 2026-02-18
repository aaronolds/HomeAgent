# Persistence: JSONL Transcript Writer

## Overview
Implement the append-only JSONL transcript writer for session transcripts. JSONL is the **authoritative store** for all conversation data — every turn, tool call, and agent response is persisted as a line in the session's JSONL file. This is fundamental to HomeAgent's data sovereignty model.

## Scope

**Included:**
- Append-only JSONL writer for session transcripts
- File path convention: `~/.homeagent/agents/<agentId>/sessions/<sessionId>.jsonl`
- Auto-create directory structure on first write
- Typed turn records: user message, assistant response, tool call, tool result, system event
- File locking to prevent concurrent writes to same session
- Crash-safe writes: flush after each append, use `O_APPEND` flag
- Session transcript reader: load and parse all turns for a session
- File permissions hardened to `0600`

**Excluded:**
- Compacted summaries (see #015)
- SQLite indexes (see #011)
- Audit log (see #013)

## Technical Requirements

### Turn Record Schema
```typescript
import { z } from 'zod';

export const TurnRole = z.enum(['user', 'assistant', 'tool', 'system']);

export const TranscriptEntry = z.object({
  turnId: z.string(),
  role: TurnRole,
  content: z.string().optional(),
  toolCalls: z.array(z.object({
    id: z.string(),
    name: z.string(),
    args: z.record(z.unknown()),
  })).optional(),
  toolResults: z.array(z.object({
    callId: z.string(),
    result: z.unknown(),
    error: z.string().optional(),
  })).optional(),
  metadata: z.object({
    model: z.string().optional(),
    tokens: z.object({ prompt: z.number(), completion: z.number() }).optional(),
    runId: z.string().optional(),
    provider: z.string().optional(),
  }).optional(),
  ts: z.number(),
});
```

### Writer API
```typescript
class TranscriptWriter {
  constructor(private basePath: string) {}

  async append(agentId: string, sessionId: string, entry: TranscriptEntry): Promise<void>;
  async read(agentId: string, sessionId: string): Promise<TranscriptEntry[]>;
  async readStream(agentId: string, sessionId: string): AsyncIterable<TranscriptEntry>;
  
  private resolvePath(agentId: string, sessionId: string): string;
  private ensureDirectory(path: string): Promise<void>;
}
```

### Path Validation
- Reject `agentId` or `sessionId` containing `/`, `\`, `..`, or null bytes
- Resolve with `fs.realpath()` and verify prefix is `~/.homeagent/agents/`
- Reject symlinks outside the allowed prefix

## Implementation Plan

1. Create `packages/runtime/src/persistence/transcript-writer.ts`
2. Implement path resolution with security validation
3. Implement `append()` with `O_APPEND` flag and flush
4. Implement file permissions setting (`0600`)
5. Implement `read()` — parse all lines, validate each with Zod
6. Implement `readStream()` — async line-by-line reader
7. Add file locking (advisory lock via `proper-lockfile` or `flock`)
8. Auto-create directory structure on first write
9. Write tests:
   - Append single turn and read back
   - Append multiple turns and read all
   - Concurrent append attempts are serialized by lock
   - Path traversal in agentId/sessionId is rejected
   - Symlink escape is rejected
   - File is created with `0600` permissions
   - Corrupt JSONL line is handled gracefully (skip or error)

## Acceptance Criteria
- [ ] Turns are appended as single JSON lines to `<sessionId>.jsonl`
- [ ] Directory structure is auto-created on first write
- [ ] File permissions are set to `0600`
- [ ] Reads parse all lines and validate with Zod
- [ ] Streaming reads work for large transcripts
- [ ] File locking prevents concurrent write corruption
- [ ] Path traversal attacks are rejected
- [ ] Symlink escapes outside `~/.homeagent/agents/` are rejected
- [ ] Writes are crash-safe (flushed, `O_APPEND`)
- [ ] All tests pass

## Priority
**Critical** — JSONL is the authoritative data store.

**Scoring:**
- User Impact: 5 (all conversation data persists here)
- Strategic Alignment: 5 (core architecture decision)
- Implementation Feasibility: 5 (well-understood patterns)
- Resource Requirements: 2 (moderate)
- Risk Level: 1 (low; file ops are well-tested)
- **Score: 12.5**

## Dependencies
- **Blocks:** #014, #015, #016
- **Blocked by:** #002, #004

## Implementation Size
- **Estimated effort:** Medium (2-3 days)
- **Labels:** `enhancement`, `high-priority`, `phase-4`, `persistence`, `runtime`
