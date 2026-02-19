# Add runtime streaming, tool execution, and run ID lifecycle

## Summary

Implement streaming model adapter, tool-call loop execution, deterministic replay safety, and run lifecycle APIs.

## Scope

- Stream assistant deltas over WebSocket
- Tool-call execution loop with result streaming
- Deterministic replay protections for side effects
- `runId` lifecycle for tracking, cancellation, and event correlation
- Turn persistence integration with JSONL transcripts

## Acceptance Criteria

- `agent.run` returns `runId`
- Clients can correlate streamed events to a run
- `agent.cancel` terminates active run cleanly
- Tool execution outcomes persist and stream consistently

## Dependencies

- #004
- #006
- #007

## Suggested Labels

- `type:feature`
- `area:runtime`
- `priority:p0`

## Source

- `docs/plan.combined.md` (Phase 5)
