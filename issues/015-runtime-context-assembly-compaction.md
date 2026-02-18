# Agent Runtime: Context Assembly & Rolling Summary Compaction

## Overview
Implement the context assembly pipeline that builds the LLM prompt from session history, workspace files, and bootstrap content, along with the rolling summary compaction system that manages long conversations within token budgets.

## Scope

**Included:**
- Token budget tracking: calculate remaining tokens after system prompt, bootstrap files, and workspace files
- Context assembly pipeline: combine system instructions + bootstrap + workspace + session history into a single prompt
- Recency bias: always include the most recent N turns verbatim (configurable, default 20)
- Rolling summary compaction: when transcript exceeds configurable threshold (default: 75% of context window), summarize older turns
- Compacted summaries stored as `<sessionId>.compacted.jsonl`
- Compaction trigger: runs at start of context assembly, not mid-turn
- Prompt injection mitigations: user content wrapped in delimiters (`<user_context>...</user_context>`)
- Tool result sanitization: length-capped before inclusion in prompt
- Token counting utility (tiktoken or similar)

**Excluded:**
- Model inference and streaming (see #016)
- Tool execution (see #016)
- Hook system (see #017)

## Technical Requirements

### Context Assembler
```typescript
interface ContextAssemblerConfig {
  maxContextTokens: number;      // e.g., 128_000
  compactionThreshold: number;   // e.g., 0.75 (75%)
  recentTurnsToKeep: number;     // e.g., 20
  maxToolResultLength: number;   // e.g., 10_000 chars
}

interface AssembledContext {
  messages: LLMMessage[];
  tokenCount: number;
  compacted: boolean;
  compactionSummary?: string;
}

class ContextAssembler {
  constructor(private config: ContextAssemblerConfig) {}

  async assemble(params: {
    systemPrompt: string;
    bootstrapFiles: BootstrapContent[];
    workspaceFiles: WorkspaceFile[];
    transcript: TranscriptEntry[];
    compactionHistory?: string[];
  }): Promise<AssembledContext>;
}
```

### Rolling Summary Compaction
```typescript
class CompactionManager {
  async shouldCompact(tokenCount: number, maxTokens: number, threshold: number): boolean;
  
  async compact(params: {
    transcript: TranscriptEntry[];
    recentTurnsToKeep: number;
    model: string;
  }): Promise<{
    summary: string;
    compactedTurnIds: string[];
  }>;
  
  async saveCompaction(
    agentId: string,
    sessionId: string,
    summary: string,
    compactedTurnIds: string[]
  ): Promise<void>;
}
```

### Content Delimiting (Prompt Injection Mitigation)
```typescript
function wrapUserContent(content: string, source: string): string {
  return `<user_context source="${source}">\n${content}\n</user_context>`;
}

function sanitizeToolResult(result: unknown, maxLength: number): string {
  const str = typeof result === 'string' ? result : JSON.stringify(result);
  return str.length > maxLength ? str.slice(0, maxLength) + '\n[truncated]' : str;
}
```

## Implementation Plan

1. Add token counting dependency (`js-tiktoken` or `tiktoken`)
2. Create `packages/runtime/src/context/assembler.ts` — main assembly pipeline
3. Create `packages/runtime/src/context/token-counter.ts` — token counting utility
4. Create `packages/runtime/src/context/compaction.ts` — rolling summary compaction
5. Create `packages/runtime/src/context/sanitizer.ts` — tool result sanitization + content delimiting
6. Implement assembly order: system prompt → bootstrap → compaction summary → workspace → recent turns
7. Implement compaction trigger check at assembly start
8. Store compacted summaries to `<sessionId>.compacted.jsonl`
9. Write tests:
   - Assembly includes all components in correct order
   - Token budget is respected
   - Compaction triggers when threshold exceeded
   - Recent turns are always preserved (never compacted)
   - Compacted summary replaces older turns
   - User content is wrapped in delimiters
   - Tool results are length-capped
   - Compaction file is created alongside transcript
   - Empty transcript assembles correctly (first turn)

## Acceptance Criteria
- [ ] Context assembly combines system prompt, bootstrap, workspace, and history
- [ ] Token counting is accurate for the configured model
- [ ] Assembly respects the configured token budget
- [ ] Compaction triggers at configurable threshold (default 75%)
- [ ] Most recent N turns (default 20) are always included verbatim
- [ ] Older turns are summarized by the LLM and stored in `.compacted.jsonl`
- [ ] User-generated content is wrapped in `<user_context>` delimiters
- [ ] Tool results are sanitized and length-capped
- [ ] Context assembly inputs are logged for forensic review
- [ ] All tests pass

## Priority
**High** — context management is essential for useful agent conversations.

**Scoring:**
- User Impact: 5 (conversation quality depends on context)
- Strategic Alignment: 5 (core runtime feature)
- Implementation Feasibility: 3 (token management is nuanced)
- Resource Requirements: 3 (moderate complexity)
- Risk Level: 2 (subtle bugs affect conversation quality)
- **Score: 4.2**

## Dependencies
- **Blocks:** #016
- **Blocked by:** #010, #014

## Implementation Size
- **Estimated effort:** Large (3-5 days)
- **Labels:** `enhancement`, `high-priority`, `phase-5`, `runtime`, `llm`
