# Implement config package defaults and schema exports

## Summary

Create centralized config package for default values, validation, and JSON schema export used by gateway/runtime/providers.

## Scope

- Define config schema and defaults
- Include rate limits, frame limits, heartbeat, compaction thresholds, and security toggles
- Export JSON Schema for operator tooling/docs
- Wire consuming packages to typed config APIs

## Acceptance Criteria

- Config validates at startup with clear typed errors
- All major runtime/gateway security controls are configurable
- Schema export is versioned and documented

## Dependencies

- #002
- #001

## Suggested Labels

- `type:feature`
- `area:config`
- `priority:p1`

## Source

- `docs/plan.combined.md` (Phase 1, 3, 9)
