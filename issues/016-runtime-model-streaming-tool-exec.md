# Agent Runtime: Model Streaming Adapter & Tool Execution

## Overview
Implement the model streaming adapter abstraction that interfaces with LLM providers (OpenAI, Anthropic) and the tool execution framework that runs tool calls requested by the model. Together these form the core of the agentic loop — inference, tool calls, and streamed results.

## Scope

**Included:**
- Model adapter abstraction: common interface for OpenAI and Anthropic SDKs
- Streaming: stream assistant deltas back to clients over WebSocket as `agent.delta` events
- Tool call detection: parse tool-use responses from both providers
- Tool execution framework: dispatch tool calls to registered handlers
- Streamed tool results: tool execution results sent back as `agent.tool_call` events
- Deterministic replay protection: idempotency keys on tool calls to prevent double-execution
- Turn persistence: append completed turn to JSONL transcript
- `agent.turn_complete` event emitted at turn end
- `agent.error` event on failures
- Multi-turn agentic loop: continue calling the model until no tool calls remain

**Excluded:**
- Specific tool implementations (see #019)
- Hook injection points (see #017)
- Context assembly (see #015)

## Technical Requirements

### Model Adapter Interface
```typescript
interface ModelAdapter {
  readonly provider: 'openai' | 'anthropic';
  
  streamChat(params: {
    model: string;
    messages: LLMMessage[];
    tools?: ToolDefinition[];
    temperature?: number;
    maxTokens?: number;
  }): AsyncIterable<StreamChunk>;
}

type StreamChunk =
  | { type: 'delta'; content: string }
  | { type: 'tool_call'; id: string; name: string; args: Record<string, unknown> }
  | { type: 'finish'; reason: 'stop' | 'tool_use' | 'max_tokens' }
  | { type: 'usage'; prompt_tokens: number; completion_tokens: number };
```

### OpenAI Adapter
```typescript
import OpenAI from 'openai';

class OpenAIAdapter implements ModelAdapter {
  readonly provider = 'openai';
  private client: OpenAI;

  async *streamChat(params: StreamParams): AsyncIterable<StreamChunk> {
    const stream = await this.client.chat.completions.create({
      ...params,
      stream: true,
    });
    for await (const chunk of stream) {
      // Parse and yield StreamChunks
    }
  }
}
```

### Anthropic Adapter
```typescript
import Anthropic from '@anthropic-ai/sdk';

class AnthropicAdapter implements ModelAdapter {
  readonly provider = 'anthropic';
  private client: Anthropic;

  async *streamChat(params: StreamParams): AsyncIterable<StreamChunk> {
    const stream = this.client.messages.stream({
      model: params.model,
      messages: params.messages,
      tools: params.tools,
      max_tokens: params.maxTokens ?? 4096,
    });
    for await (const event of stream) {
      // Parse and yield StreamChunks
    }
  }
}
```

### Tool Execution Framework
```typescript
interface ToolHandler {
  name: string;
  description: string;
  parameters: ZodSchema;
  execute(args: unknown, context: ToolContext): Promise<unknown>;
}

interface ToolContext {
  agentId: string;
  sessionId: string;
  runId: string;
  workspacePath: string;
}

class ToolExecutor {
  private handlers = new Map<string, ToolHandler>();

  register(handler: ToolHandler): void;
  async execute(toolCall: ToolCall, context: ToolContext): Promise<ToolResult>;
}
```

### Agentic Loop Core
```typescript
async function agenticLoop(params: {
  context: AssembledContext;
  adapter: ModelAdapter;
  toolExecutor: ToolExecutor;
  eventBus: EventBus;
  transcriptWriter: TranscriptWriter;
  runId: string;
  sessionId: string;
  agentId: string;
}): Promise<void> {
  let messages = params.context.messages;
  
  while (true) {
    // 1. Call model with streaming
    // 2. Emit agent.delta events for each content chunk
    // 3. If tool_calls: execute tools, emit agent.tool_call events
    // 4. Append turn to transcript
    // 5. If finish_reason === 'stop': break
    // 6. If finish_reason === 'tool_use': continue with tool results
  }
  
  // Emit agent.turn_complete
}
```

## Implementation Plan

1. Create `packages/runtime/src/models/types.ts` — ModelAdapter interface, StreamChunk types
2. Create `packages/runtime/src/models/openai.ts` — OpenAI adapter
3. Create `packages/runtime/src/models/anthropic.ts` — Anthropic adapter
4. Create `packages/runtime/src/models/factory.ts` — adapter factory based on config
5. Create `packages/runtime/src/tools/types.ts` — ToolHandler interface
6. Create `packages/runtime/src/tools/executor.ts` — tool dispatch and execution
7. Create `packages/runtime/src/loop/agentic-loop.ts` — multi-turn loop
8. Wire event bus to emit `agent.delta`, `agent.tool_call`, `agent.turn_complete`, `agent.error`
9. Wire transcript writer to persist each turn
10. Add timeout handling: configurable max loop iterations and wall-clock timeout
11. Write tests:
    - OpenAI adapter streams deltas correctly (mocked)
    - Anthropic adapter streams deltas correctly (mocked)
    - Tool call detected and dispatched to correct handler
    - Multi-turn loop continues until model stops
    - Turn persisted to transcript after each loop iteration
    - Events emitted in correct order
    - Timeout terminates loop gracefully
    - Error in tool execution emits `agent.error` and continues/stops appropriately

## Acceptance Criteria
- [ ] Model adapter abstraction supports both OpenAI and Anthropic
- [ ] Streaming deltas are emitted as `agent.delta` WebSocket events
- [ ] Tool calls are parsed from model responses
- [ ] Tool handlers are registered and dispatched correctly
- [ ] Tool results are streamed as `agent.tool_call` events
- [ ] Multi-turn agentic loop continues until the model emits `stop`
- [ ] Each turn is appended to the JSONL transcript
- [ ] `agent.turn_complete` emitted at loop end
- [ ] `agent.error` emitted on failures
- [ ] Timeouts prevent infinite loops
- [ ] All tests pass

## Priority
**Critical** — this is the core value proposition of HomeAgent.

**Scoring:**
- User Impact: 5 (the agent can't function without this)
- Strategic Alignment: 5 (core product)
- Implementation Feasibility: 3 (streaming + multi-provider)
- Resource Requirements: 4 (significant complexity)
- Risk Level: 2 (streaming edge cases)
- **Score: 3.1**

## Dependencies
- **Blocks:** #017, #019, #022
- **Blocked by:** #010, #014, #015, #012 (LLM API keys)

## Implementation Size
- **Estimated effort:** Large (4-5 days)
- **Labels:** `enhancement`, `high-priority`, `phase-5`, `runtime`, `llm`, `streaming`
